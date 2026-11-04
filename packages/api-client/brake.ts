export type Verdict = { go: true } | { go: false; tripped: boolean; waitMs: number };

/**
 * Stops one tab hammering one address: past `limit` calls within `windowMs`, that address
 * rests, and its calls are held until the rest ends, then answered on the phone. Held, not
 * answered at once, or a loop would spin on the phone instead; each rest is twice the last.
 * A person never gets near it (a pull to refresh asks each address once, live updates in a
 * rush a few a second); only a loop does (20 a second on 2026-11-04), and then the calls never
 * leave the phone, so they cost neither Cloudflare nor Go.
 */
export function createBrake({
    limit = 50,
    windowMs = 10_000,
    restMs = 30_000,
    maxRestMs = 10 * 60_000,
    now = Date.now,
} = {}) {
    const calls = new Map<string, number[]>();
    const restUntil = new Map<string, number>();
    const strikes = new Map<string, number>();
    return (key: string): Verdict => {
        const t = now();
        const until = restUntil.get(key) ?? 0;
        if (until > t) return { go: false, tripped: false, waitMs: until - t };
        const recent = (calls.get(key) ?? []).filter((at) => t - at < windowMs);
        recent.push(t);
        if (recent.length <= limit) {
            calls.set(key, recent);
            return { go: true };
        }
        const strike = (strikes.get(key) ?? 0) + 1;
        const rest = Math.min(restMs * 2 ** (strike - 1), maxRestMs);
        strikes.set(key, strike);
        calls.delete(key);
        restUntil.set(key, t + rest);
        // "tripped" only for the call that starts a rest, so it is reported once per rest.
        return { go: false, tripped: true, waitMs: rest };
    };
}
