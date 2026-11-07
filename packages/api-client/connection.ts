import { useSyncExternalStore } from "react";

/**
 * How well the phone reaches the API, from the requests the app makes anyway (no pings): the time
 * each spends on the way, without Go's own time (Server-Timing's `app`), averaged over the last few.
 * `failing`: requests fail on the way or run out of time; `offline`: the phone says it has no network.
 */
export type Level = "good" | "okay" | "slow" | "failing" | "offline";

export interface Connection {
    level: Level;
    /** When the current trouble began; 0 when there is none. */
    since: number;
    /** When the API last answered anything. */
    lastAnswerAt: number;
    /** The way's average, in ms; undefined before the first answer. */
    ms?: number;
}

const SAMPLES = 5;
// Each level is left only a little past its line, so a speed sitting on it does not flicker.
const OKAY_MS = 300;
const SLOW_MS = 1000;
const MARGIN = 0.8;

let offlineSince = typeof navigator !== "undefined" && !navigator.onLine ? Date.now() : 0;
let failingSince = 0;
let slowSince = 0;
let lastAnswerAt = 0;
let speedLevel: "good" | "okay" | "slow" = "good";
const samples: number[] = [];
const listeners = new Set<() => void>();

function average() {
    return samples.length
        ? Math.round(samples.reduce((a, b) => a + b, 0) / samples.length)
        : undefined;
}

/** The speed's level: up past a line, back down only below 80 % of it. */
function speed(ms: number | undefined): "good" | "okay" | "slow" {
    if (ms === undefined) return speedLevel;
    const slowLine = speedLevel === "slow" ? SLOW_MS * MARGIN : SLOW_MS;
    const okayLine = speedLevel === "good" ? OKAY_MS : OKAY_MS * MARGIN;
    return ms > slowLine ? "slow" : ms > okayLine ? "okay" : "good";
}

function make(): Connection {
    const ms = average();
    if (offlineSince) return { level: "offline", since: offlineSince, lastAnswerAt, ms };
    if (failingSince) return { level: "failing", since: failingSince, lastAnswerAt, ms };
    return { level: speedLevel, since: speedLevel === "slow" ? slowSince : 0, lastAnswerAt, ms };
}

let snapshot: Connection = make();

function update() {
    const next = make();
    const changed = next.level !== snapshot.level || next.since !== snapshot.since;
    snapshot = next;
    if (changed) listeners.forEach((fn) => fn());
}

/** The API answered, after `wayMs` on the way there and back. */
export function noteAnswer(wayMs?: number) {
    lastAnswerAt = Date.now();
    failingSince = 0;
    if (wayMs !== undefined && wayMs >= 0) {
        samples.push(wayMs);
        if (samples.length > SAMPLES) samples.shift();
    }
    const next = speed(average());
    if (next === "slow" && speedLevel !== "slow") slowSince = Date.now();
    if (next !== "slow") slowSince = 0;
    speedLevel = next;
    update();
}

/** A request failed on the way, or ran out of time. Offline already says more. */
export function noteTrouble() {
    if (!failingSince) failingSince = Date.now();
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

/** The phone's own network kind, where the browser tells it (Chrome on Android): `4g`, `3g`. */
export function networkKind(): string | undefined {
    return (navigator as Navigator & { connection?: { effectiveType?: string } }).connection
        ?.effectiveType;
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
