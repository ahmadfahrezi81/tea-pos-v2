import { api } from "@tea-pos/api-client";
import { onLive } from "@tea-pos/api-client/live";
import { useSyncExternalStore } from "react";

/** A phone says it is typing at most this often; the others show it this long after the last. */
const SEND_EVERY_MS = 3000;
const SHOW_MS = 5000;

/** channel → who is typing → until when. */
const typing = new Map<string, Map<string, number>>();
/** channel → who is typing now: a new array only when it changes, as React wants. */
let active = new Map<string, string[]>();
const EMPTY: string[] = [];
const watchers = new Set<() => void>();
const changed = () => {
    const now = Date.now();
    active = new Map(
        [...typing].map(([channel, who]) => [
            channel,
            [...who].filter(([, until]) => until > now).map(([id]) => id),
        ]),
    );
    watchers.forEach((w) => w());
};
const watch = (w: () => void) => {
    watchers.add(w);
    return () => void watchers.delete(w);
};

onLive((e) => {
    if (e.kind !== "chat_typing" || !e.id || !e.by) return;
    const who = typing.get(e.id) ?? new Map<string, number>();
    who.set(e.by, Date.now() + SHOW_MS);
    typing.set(e.id, who);
    changed();
    setTimeout(changed, SHOW_MS + 50);
});

/** Someone's message arrived: they have stopped typing. */
export function stoppedTyping(channel: string, user: string) {
    if (typing.get(channel)?.delete(user)) changed();
}

/** Who is typing in a channel now (user ids). */
export function useTyping(channel: string): string[] {
    return useSyncExternalStore(watch, () => active.get(channel) ?? EMPTY);
}

const lastSent = new Map<string, number>();

/** Tells the channel this phone is typing, at most every 3 seconds; a failure is not worth a word. */
export function sayTyping(tenant: string, channel: string) {
    const now = Date.now();
    if (now - (lastSent.get(channel) ?? 0) < SEND_EVERY_MS) return;
    lastSent.set(channel, now);
    void api
        .POST("/tenants/{tenant}/chat/channels/{id}/typing", {
            params: { path: { tenant, id: channel } },
        })
        .catch(() => undefined);
}

/** After sending, the next keystroke says typing again at once. */
export function doneTyping(channel: string) {
    lastSent.delete(channel);
}
