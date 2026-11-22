import { api, type components } from "@tea-pos/api-client";
import { uploadPhoto } from "@tea-pos/api-client/files";
import { shrinkPhoto } from "@tea-pos/ui/shrink";
import type { QueryClient } from "@tanstack/react-query";

import { hold } from "./queries";

/** A message on its way: shown at once, with a clock, until the server's copy replaces it. */
export interface Pending {
    key: string;
    channel: string;
    body: string;
    at: string;
    state: "sending" | "failed";
    photos: OutPhoto[];
    /** The message it answers, quoted above it. */
    replyTo?: components["schemas"]["ChatQuote"];
}

/** A photo on its way: the phone's own copy shows at once; uploaded once, kept across retries. */
export interface OutPhoto {
    file: Blob;
    local: string;
    uploaded?: components["schemas"]["ChatPhotoInput"];
}

/** The longest side of the preview the message list loads (about 20 KB). */
const PREVIEW_SIDE = 320;

/** Both sizes shrunk on the phone and uploaded straight to Storage, then remembered. */
async function upload(tenant: string, photo: OutPhoto) {
    if (photo.uploaded) return;
    // Uncropped: a photo in a chat keeps its own shape.
    const full = await shrinkPhoto(photo.file, false);
    const preview = await shrinkPhoto(photo.file, false, PREVIEW_SIDE);
    const size = await createImageBitmap(full);
    const to = { tenant, purpose: "chat_photo" as const };
    const [a, b] = await Promise.all([uploadPhoto(to, full), uploadPhoto(to, preview)]);
    photo.uploaded = { path: a.path, previewPath: b.path, width: size.width, height: size.height };
    size.close();
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
    for (const p of pending)
        if (p.key === key) p.photos.forEach((ph) => URL.revokeObjectURL(ph.local));
    pending = pending.filter((p) => p.key !== key);
    emit();
}

async function attempt(queryClient: QueryClient, tenant: string, p: Pending) {
    const started = Date.now();
    let wait = 1000;
    for (;;) {
        try {
            await Promise.all(p.photos.map((photo) => upload(tenant, photo)));
            const photos = p.photos.flatMap((photo) => (photo.uploaded ? [photo.uploaded] : []));
            const { data, error } = await api.POST(
                "/tenants/{tenant}/chat/channels/{id}/messages",
                {
                    params: { path: { tenant, id: p.channel } },
                    // The same key every try: Go saves it once however often it arrives.
                    headers: { "Idempotency-Key": p.key },
                    body: {
                        body: p.body,
                        photos: photos.length ? photos : undefined,
                        replyTo: p.replyTo?.id,
                    },
                },
            );
            if (data) {
                // Go answers with the quote's id only: this phone already has the rest.
                const quote = data.replyTo && p.replyTo ? p.replyTo : data.replyTo;
                hold(queryClient, tenant, p.channel, { ...data, replyTo: quote });
                forget(p.key);
                return;
            }
            if (FINAL.has(error?.code ?? "")) break;
            // The message it answered was deleted meanwhile: sent without the quote.
            if (error?.code === "message_not_found" && p.replyTo) {
                p.replyTo = undefined;
                continue;
            }
        } catch {
            // No connection: tried again below.
        }
        if (Date.now() - started > GIVE_UP_MS) break;
        await new Promise((r) => setTimeout(r, wait));
        wait = Math.min(wait * 2, 8000);
    }
    set(p.key, "failed");
}

export function send(
    queryClient: QueryClient,
    tenant: string,
    channel: string,
    body: string,
    files: Blob[] = [],
    replyTo?: Pending["replyTo"],
) {
    const p: Pending = {
        replyTo,
        key: crypto.randomUUID(),
        channel,
        body,
        at: new Date().toISOString(),
        state: "sending",
        photos: files.map((file) => ({ file, local: URL.createObjectURL(file) })),
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
