import { useSyncExternalStore } from "react";

/**
 * How the phone reaches the API: `offline` when the phone says it has no network, `slow` when it
 * has one but requests fail on the way or run out of time (cleared by the next answer).
 */
export interface Connection {
    state: "online" | "slow" | "offline";
    /** When the current trouble began. */
    since: number;
    /** When the API last answered anything. */
    lastAnswerAt: number;
}

let offlineSince = typeof navigator !== "undefined" && !navigator.onLine ? Date.now() : 0;
let slowSince = 0;
let lastAnswerAt = 0;
let snapshot: Connection = make();
const listeners = new Set<() => void>();

function make(): Connection {
    if (offlineSince) return { state: "offline", since: offlineSince, lastAnswerAt };
    if (slowSince) return { state: "slow", since: slowSince, lastAnswerAt };
    return { state: "online", since: 0, lastAnswerAt };
}

function update() {
    const next = make();
    if (next.state === snapshot.state && next.since === snapshot.since) {
        snapshot = { ...snapshot, lastAnswerAt };
        return;
    }
    snapshot = next;
    listeners.forEach((fn) => fn());
}

/** The API answered: whatever the answer, the way to it works. */
export function noteAnswer() {
    lastAnswerAt = Date.now();
    slowSince = 0;
    update();
}

/** A request failed on the way, or ran out of time. Offline already says more. */
export function noteTrouble() {
    if (!slowSince) slowSince = Date.now();
    update();
}

if (typeof window !== "undefined") {
    window.addEventListener("offline", () => {
        offlineSince = Date.now();
        update();
    });
    window.addEventListener("online", () => {
        offlineSince = 0;
        update();
    });
}

export const connection = () => snapshot;

export function useConnection(): Connection {
    return useSyncExternalStore(
        (fn) => {
            listeners.add(fn);
            return () => listeners.delete(fn);
        },
        () => snapshot,
    );
}
