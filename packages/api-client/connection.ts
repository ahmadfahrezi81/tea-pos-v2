import { useSyncExternalStore } from "react";

/**
 * How well the phone reaches the API, from the requests the app makes anyway (no pings): the time
 * each spends on the way, without Go's own time (Server-Timing's `app`), averaged over the last few.
 * `failing`: requests fail on the way or run out of time; `offline`: the phone says it has no network.
 */
export type Level = "good" | "slow" | "failing" | "offline";

const SAMPLES = 5;
const SLOW_MS = 1000;
// Slow is left only below 80 % of its line, so a speed sitting on it does not flicker.
const MARGIN = 0.8;

let offline = typeof navigator !== "undefined" && !navigator.onLine;
let failing = false;
let slow = false;
const samples: number[] = [];
const listeners = new Set<() => void>();

const make = (): Level => (offline ? "offline" : failing ? "failing" : slow ? "slow" : "good");
let level: Level = make();

function update() {
    const next = make();
    if (next === level) return;
    level = next;
    listeners.forEach((fn) => fn());
}

/** The API answered, after `wayMs` on the way there and back. */
export function noteAnswer(wayMs?: number) {
    failing = false;
    if (wayMs !== undefined && wayMs >= 0) {
        samples.push(wayMs);
        if (samples.length > SAMPLES) samples.shift();
        const average = samples.reduce((a, b) => a + b, 0) / samples.length;
        slow = average > (slow ? SLOW_MS * MARGIN : SLOW_MS);
    }
    update();
}

/** A request failed on the way, or ran out of time. */
export function noteTrouble() {
    failing = true;
    update();
}

if (typeof window !== "undefined") {
    window.addEventListener("offline", () => {
        offline = true;
        update();
    });
    window.addEventListener("online", () => {
        offline = false;
        update();
    });
}

export function useConnection(): Level {
    return useSyncExternalStore(
        (fn) => {
            listeners.add(fn);
            return () => listeners.delete(fn);
        },
        () => level,
    );
}
