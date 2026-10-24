import type { components } from "@tea-pos/api-client";
import { APP_TAG } from "@tea-pos/api-client/status";
import type { AnyRouter } from "@tanstack/react-router";

type AppEvent = components["schemas"]["AppEvent"];

declare global {
    /** Started by index.html, which queues errors from before the app runs (packages/config/vite.ts). */
    var __events: AppEvent[] | undefined;
}

const SEND_EVERY_MS = 10_000;
const BATCH = 20;
/** Signed out nothing is sent; past this, new events are dropped. */
const MAX_QUEUED = 100;

function queue(event: AppEvent) {
    const q = (globalThis.__events ??= []);
    if (q.length < MAX_QUEUED) q.push(event);
}

/** An error a screen caught (the router's error boundary) never reaches window's error event. */
export function reportError(error: unknown) {
    const e = error instanceof Error ? error : new Error(String(error));
    queue({
        type: "error",
        name: e.name,
        message: e.message.slice(0, 2000),
        stack: (e.stack ?? "").slice(0, 8000),
        path: location.pathname,
        at: new Date().toISOString(),
    });
}

/**
 * Page views and errors go to Go's /api/events, which sends them on to PostHog: the phone
 * never loads PostHog. Sent every few seconds, and as the app goes to the background; a
 * failed send is dropped, never retried.
 */
export function startEvents(router: AnyRouter) {
    router.subscribe("onResolved", ({ toLocation }) => {
        queue({ type: "pageview", path: toLocation.pathname, at: new Date().toISOString() });
    });

    const send = (leaving: boolean) => {
        const q = (globalThis.__events ??= []);
        if (!q.length || location.pathname === "/login") return;
        void fetch("/api/events", {
            method: "POST",
            // Finishes after the page is gone; small batches stay under its 64 KB limit.
            keepalive: leaving,
            headers: { "Content-Type": "application/json", "X-App-Version": APP_TAG },
            body: JSON.stringify({ events: q.splice(0, BATCH) }),
        }).catch(() => {});
    };
    setInterval(() => send(false), SEND_EVERY_MS);
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") send(true);
    });
}
