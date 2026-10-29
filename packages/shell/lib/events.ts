import type { components } from "@tea-pos/api-client";
import type { AnyRouter } from "@tanstack/react-router";

type AppEvent = components["schemas"]["AppEvent"];
type Device = components["schemas"]["Device"];
type Ready = components["schemas"]["AppReady"];

declare global {
    /** Started by index.html, which queues errors from before the app runs (packages/config/vite.ts). */
    var __events: AppEvent[] | undefined;
    /** Set by index.html when the page was hidden at any moment since it started loading. */
    var __wasHidden: boolean | undefined;
    /** Set by the shell as it lifts the splash: whether it drew /me from the phone's copy. */
    var __readyMe: "saved" | "network" | undefined;
    /** Stack → chunk id, injected into each file at deploy (PostHog's CLI, pages.yml). */
    var _posthogChunkIds: Record<string, string> | undefined;
}

const SEND_EVERY_MS = 10_000;
const BATCH = 20;
/** Signed out nothing is sent; past this, new events are dropped. */
const MAX_QUEUED = 100;
/** A visit ends after this long without use, as in PostHog's own library. */
const SESSION_IDLE_MS = 30 * 60_000;
const SESSION_KEY = "tea-pos:session";
const BUILD_KEY = "tea-pos:build";

function queue(event: AppEvent) {
    const q = (globalThis.__events ??= []);
    if (q.length < MAX_QUEUED) q.push(event);
}

const now = () => new Date().toISOString();

/** An error a screen caught (the router's error boundary) never reaches window's error event. */
export function reportError(error: unknown) {
    const e = error instanceof Error ? error : new Error(String(error));
    queue({
        type: "error",
        name: e.name,
        message: e.message.slice(0, 2000),
        stack: (e.stack ?? "").slice(0, 8000),
        path: location.pathname,
        at: now(),
    });
}

/** A UUIDv7: time first, so PostHog orders visits by it. */
function uuid7(): string {
    const b = crypto.getRandomValues(new Uint8Array(16));
    let t = Date.now();
    for (let i = 5; i >= 0; i--, t = Math.floor(t / 256)) b[i] = t % 256;
    b[6] = (b[6]! & 0x0f) | 0x70;
    b[8] = (b[8]! & 0x3f) | 0x80;
    const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

let sessionId = "";
/** The current visit, kept across reloads; a new one after 30 idle minutes. */
function session(): string {
    try {
        const saved = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null") as {
            id: string;
            last: number;
        } | null;
        sessionId = saved && Date.now() - saved.last < SESSION_IDLE_MS ? saved.id : uuid7();
        localStorage.setItem(SESSION_KEY, JSON.stringify({ id: sessionId, last: Date.now() }));
    } catch {
        // No storage: one visit per page load.
        sessionId ||= uuid7();
    }
    return sessionId;
}

interface NetworkInformation {
    effectiveType?: string;
    rtt?: number;
    downlink?: number;
    saveData?: boolean;
}
interface UserAgentData {
    getHighEntropyValues(hints: string[]): Promise<{ model?: string; platformVersion?: string }>;
}

const device: Device = {};
function readDevice() {
    const nav = navigator as Navigator & {
        connection?: NetworkInformation;
        deviceMemory?: number;
        userAgentData?: UserAgentData;
    };
    device.screenWidth = screen.width;
    device.screenHeight = screen.height;
    device.memory = nav.deviceMemory;
    device.cores = nav.hardwareConcurrency;
    // Android Chrome names the phone (SM-M115F is a Galaxy M11); others say nothing.
    nav.userAgentData
        ?.getHighEntropyValues(["model", "platformVersion"])
        .then((v) => {
            device.model = v.model || undefined;
            device.osVersion = v.platformVersion || undefined;
        })
        .catch(() => {});
}

/** The network now, not at start: it changes as the seller moves. */
function network(): Device {
    const c = (navigator as Navigator & { connection?: NetworkInformation }).connection;
    return {
        ...device,
        net: c?.effectiveType,
        rtt: c?.rtt,
        downlink: c?.downlink,
        saveData: c?.saveData,
    };
}

/** File → chunk id for the files in a stack, so PostHog finds each file's source map. */
function chunksFor(stack: string): Record<string, string> | undefined {
    const ids = globalThis._posthogChunkIds;
    if (!ids || !stack) return undefined;
    const out: Record<string, string> = {};
    for (const [chunkStack, id] of Object.entries(ids)) {
        // The injected line's own file is the first one its stack names.
        const file = /(https?:\/\/[^\s()]+?\.js)/.exec(chunkStack)?.[1];
        if (file && stack.includes(file)) out[file] = id;
    }
    return out;
}

/** How this load opened: no worker yet, the worker's copy, or the first open of a new version. */
function openKind(appTag: string): Ready["open"] {
    let last: string | null = null;
    try {
        last = localStorage.getItem(BUILD_KEY);
        localStorage.setItem(BUILD_KEY, appTag);
    } catch {
        // No storage: a saved copy can't be told from an update.
    }
    if (!navigator.serviceWorker?.controller) return "network";
    return last && last !== appTag ? "update" : "saved";
}

/** One app_ready per page load: the tea-pos:ready mark, the same one pnpm bench reads. */
function watchReady(appTag: string) {
    const open = openKind(appTag);
    if (typeof PerformanceObserver === "undefined") return;
    const observer = new PerformanceObserver((list) => {
        const mark = list.getEntriesByName("tea-pos:ready")[0];
        if (!mark) return;
        observer.disconnect();
        const nav = performance.getEntriesByType("navigation")[0] as
            PerformanceNavigationTiming | undefined;
        const paint = performance.getEntriesByName("first-contentful-paint")[0];
        const signin = location.pathname === "/login";
        const me = globalThis.__readyMe;
        queue({
            type: "app_ready",
            path: location.pathname,
            at: now(),
            ready: {
                readyMs: Math.round(mark.startTime),
                htmlMs: Math.round(nav?.responseStart ?? 0),
                jsMs: Math.round(nav?.domContentLoadedEventEnd ?? 0),
                paintMs: Math.round(paint?.startTime ?? 0),
                open,
                me: signin || !me ? "none" : me,
                screen: signin ? "signin" : me ? "shell" : "other",
                hidden: globalThis.__wasHidden === true,
            },
        });
    });
    observer.observe({ type: "mark", buffered: true });
}

/**
 * Page views, open times and errors go to Go's /api/events, which sends them on to PostHog:
 * the phone never loads PostHog. Sent every few seconds, and as the app goes to the
 * background; a failed send is dropped, never retried.
 */
/** appTag is X-App-Version, passed in: a runtime import shared with the first screen would split a chunk out of it. */
export function startEvents(router: AnyRouter, appTag: string) {
    readDevice();
    watchReady(appTag);
    // Loaded after the first screen: that screen's view is already behind us.
    queue({ type: "pageview", path: location.pathname, at: now() });
    router.subscribe("onResolved", ({ toLocation }) => {
        queue({ type: "pageview", path: toLocation.pathname, at: now() });
    });

    const send = (leaving: boolean) => {
        const q = (globalThis.__events ??= []);
        if (!q.length || location.pathname === "/login") return;
        const events = q.splice(0, BATCH);
        for (const e of events) if (e.type === "error") e.chunks = chunksFor(e.stack ?? "");
        void fetch("/api/events", {
            method: "POST",
            // Finishes after the page is gone; small batches stay under its 64 KB limit.
            keepalive: leaving,
            headers: { "Content-Type": "application/json", "X-App-Version": appTag },
            body: JSON.stringify({ events, session: session(), device: network() }),
        }).catch(() => {});
    };
    setInterval(() => send(false), SEND_EVERY_MS);
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState !== "hidden") return;
        queue({ type: "pageleave", path: location.pathname, at: now() });
        send(true);
    });
}
