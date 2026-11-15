import { api } from "@tea-pos/api-client";
import type { QueryClient } from "@tanstack/react-query";

import { hold } from "./queries";

/** A message on its way: shown at once, with a clock, until the server's copy replaces it. */
export interface Pending {
    key: string;
    channel: string;
    body: string;
    at: string;
    state: "sending" | "failed";
}

// Kept for the app's life, so leaving a channel mid-send still sends.
let pending: Pending[] = [];
const listeners = new Set<() => void>();
const emit = () => {
    pending = [...pending];
    listeners.forEach((l) => l());
};

export const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
};
export const snapshot = () => pending;

/** After this long failing, it says Not sent and waits for a tap. */
const GIVE_UP_MS = 30_000;
/** Answers that asking again cannot change. */
const FINAL = new Set([
    "channel_read_only",
    "blank_message",
    "channel_not_found",
    "not_allowed",
    "not_in_tenant",
]);

function set(key: string, state: Pending["state"]) {
    const p = pending.find((x) => x.key === key);
    if (p) {
        p.state = state;
        emit();
    }
}

/** Drops a message from the outbox: sent (its server copy is held) or deleted unsent. */
export function forget(key: string) {
    pending = pending.filter((p) => p.key !== key);
    emit();
}

async function attempt(queryClient: QueryClient, tenant: string, p: Pending) {
    const started = Date.now();
    let wait = 1000;
    for (;;) {
        try {
            const { data, error } = await api.POST(
                "/tenants/{tenant}/chat/channels/{id}/messages",
                {
                    params: { path: { tenant, id: p.channel } },
                    // The same key every try: Go saves it once however often it arrives.
                    headers: { "Idempotency-Key": p.key },
                    body: { body: p.body },
                },
            );
            if (data) {
                hold(queryClient, tenant, p.channel, data);
                forget(p.key);
                return;
            }
            if (FINAL.has(error?.code ?? "")) break;
        } catch {
            // No connection: tried again below.
        }
        if (Date.now() - started > GIVE_UP_MS) break;
        await new Promise((r) => setTimeout(r, wait));
        wait = Math.min(wait * 2, 8000);
    }
    set(p.key, "failed");
}

export function send(queryClient: QueryClient, tenant: string, channel: string, body: string) {
    const p: Pending = {
        key: crypto.randomUUID(),
        channel,
        body,
        at: new Date().toISOString(),
        state: "sending",
    };
    pending = [...pending, p];
    emit();
    void attempt(queryClient, tenant, p);
}

export function retry(queryClient: QueryClient, tenant: string, key: string) {
    const p = pending.find((x) => x.key === key);
    if (!p || p.state === "sending") return;
    set(key, "sending");
    void attempt(queryClient, tenant, p);
}
