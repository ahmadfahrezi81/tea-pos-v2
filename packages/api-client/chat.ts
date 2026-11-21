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

/** Unread across every channel, as the tab and the app icon show it. */
export function unreadTotal(channels: readonly ChatChannel[] | undefined): number {
    return (channels ?? []).reduce((n, c) => n + c.unread, 0);
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

async function subscription(): Promise<PushSubscription | null> {
    const reg = await navigator.serviceWorker.ready;
    return reg.pushManager.getSubscription();
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

/** Asks the phone (it must be a tap: browsers allow the question only then) and subscribes. No off
 * switch in the app (owner): turning it off is the phone's own settings, so nobody does it by accident. */
export async function turnPushOn(): Promise<boolean> {
    if (!pushSupported()) return false;
    if ((await Notification.requestPermission()) !== "granted") return false;
    const key = await serverKey();
    if (!key) return false;
    const reg = await navigator.serviceWorker.ready;
    const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }));
    await save(sub);
    return true;
}

/** On every start: the subscription saved again, which heals a cleared site without a word. */
export async function renewPush() {
    if (!(await pushOn())) return;
    const sub = await subscription();
    if (sub) await save(sub).catch(() => {});
}
