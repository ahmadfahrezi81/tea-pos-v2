import { useEffect } from "react";

import { $api, api, type components } from "./index";
import { STALE } from "./query";

export type ChatChannel = components["schemas"]["ChatChannel"];

/**
 * The caller's chat channels (made by Go on the first ask). Light, so the shell reads it for the
 * Chats tab's count while the chat screens themselves load only when opened.
 */
export function useChatChannels(tenant: string, enabled = true) {
    return $api.useQuery(
        "get",
        "/tenants/{tenant}/chat/channels",
        { params: { path: { tenant } } },
        { enabled: enabled && !!tenant, staleTime: STALE.QUICK, meta: { live: ["chat"] } },
    );
}

/** Unread across the caller's channels (not a chat admin's Other ones), as the tab and the app icon show it. */
export function unreadTotal(channels: readonly ChatChannel[] | undefined): number {
    return (channels ?? []).reduce((n, c) => n + (c.mine ? c.unread : 0), 0);
}

/** The unread count on the app's icon (Android, and an iPhone with notifications allowed). */
export function useAppBadge(count: number) {
    useEffect(() => {
        const nav = navigator as Navigator & {
            setAppBadge?: (n?: number) => Promise<void>;
            clearAppBadge?: () => Promise<void>;
        };
        if (!nav.setAppBadge) return;
        void (count > 0 ? nav.setAppBadge(count) : nav.clearAppBadge?.())?.catch(() => {});
    }, [count]);
}

// Push for chat (RFC: Chat (v2), Push notifications).

/** Push needs a service worker, the Push API and notifications (an iPhone: only once installed). */
export const pushSupported = () =>
    "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

/** The app's service worker, or none (the dev server has none): never waits for one. */
async function worker() {
    return (await navigator.serviceWorker.getRegistration()) ?? null;
}

async function subscription(): Promise<PushSubscription | null> {
    const reg = await worker();
    return reg ? reg.pushManager.getSubscription() : null;
}

/** The server's VAPID key, as the Push API wants it. Empty: push is off on this server. */
async function serverKey(): Promise<Uint8Array<ArrayBuffer> | null> {
    const { data } = await api.GET("/push/key");
    if (!data?.key) return null;
    const b64 = (data.key + "=".repeat((4 - (data.key.length % 4)) % 4))
        .replace(/-/g, "+")
        .replace(/_/g, "/");
    return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)) as Uint8Array<ArrayBuffer>;
}

async function save(sub: PushSubscription) {
    const json = sub.toJSON();
    await api.PUT("/push/subscription", {
        body: {
            endpoint: sub.endpoint,
            p256dh: json.keys?.p256dh ?? "",
            auth: json.keys?.auth ?? "",
        },
    });
}

/** Whether this phone gets pushes now. */
export async function pushOn(): Promise<boolean> {
    if (!pushSupported() || Notification.permission !== "granted") return false;
    return !!(await subscription());
}

export type PushState = "on" | "off" | "blocked" | "unsupported";

/** This phone's notifications, for the Chats card and Account → Notifications. */
export async function pushState(): Promise<PushState> {
    if (!pushSupported() || !(await worker())) return "unsupported";
    if (Notification.permission === "denied") return "blocked";
    return (await pushOn()) ? "on" : "off";
}

/** Why Turn on did not turn them on: the sheet says what to do, and the event says why. */
export class PushNotOn extends Error {
    constructor(
        readonly reason: "blocked" | "notAsked" | "failed",
        detail: string,
    ) {
        super(`push ${reason}: ${detail}`);
        this.name = "PushNotOn";
    }
}

/** Chrome's quiet question can never show in an installed app: past this, it is not coming. */
const ASK_TIMEOUT_MS = 15_000;

async function ask(): Promise<NotificationPermission | "timeout"> {
    if (Notification.permission !== "default") return Notification.permission;
    return Promise.race([
        Notification.requestPermission(),
        new Promise<"timeout">((done) => setTimeout(() => done("timeout"), ASK_TIMEOUT_MS)),
    ]);
}

/**
 * Asks the phone (it must be a tap: browsers allow the question only then) and subscribes;
 * throws PushNotOn, never stays silent (task 077: on a Samsung M11 the question never showed).
 */
export async function turnPushOn(): Promise<void> {
    if (!pushSupported() || !(await worker())) throw new PushNotOn("failed", "no push support");
    if (Notification.permission === "denied")
        throw new PushNotOn("blocked", "denied before asking");
    const answer = await ask();
    if (answer === "denied") throw new PushNotOn("blocked", "denied when asked");
    if (answer !== "granted") throw new PushNotOn("notAsked", `answer ${answer}`);
    const key = await serverKey();
    if (!key) throw new PushNotOn("failed", "no server key");
    try {
        const reg = await navigator.serviceWorker.ready;
        const sub =
            (await reg.pushManager.getSubscription()) ??
            (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }));
        await save(sub);
    } catch (e) {
        throw new PushNotOn("failed", e instanceof Error ? `${e.name}: ${e.message}` : String(e));
    }
}

/** Account → Notifications only, deep in the settings (owner): this phone gets no more pushes. */
export async function turnPushOff() {
    const sub = await subscription();
    if (!sub) return;
    await api.POST("/push/subscription/off", { body: { endpoint: sub.endpoint } }).catch(() => {});
    await sub.unsubscribe();
}

/** On every start: the subscription saved again, which heals a cleared site without a word. */
export async function renewPush() {
    if (!(await pushOn())) return;
    const sub = await subscription();
    if (sub) await save(sub).catch(() => {});
}
