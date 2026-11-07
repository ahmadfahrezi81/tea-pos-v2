import { failureFor } from "@tea-pos/api-client/failures";
import type { MessageKey } from "@tea-pos/i18n";
import { toast } from "@tea-pos/ui/toast";

import { openErrorSheet } from "../frame/ErrorSheet";
import { errorMessage } from "./errors";

/** Handled elsewhere: sign in, the maintenance or update screen, or the brake's own toast. */
export const QUIET = new Set([
    "not_signed_in",
    "not_allowed",
    "maintenance",
    "app_too_old",
    "too_many_requests",
]);

/** Codes that only mean our own app or Go got something wrong: never the person's to fix. */
const BROKEN = new Set([
    "bad_request",
    "internal",
    "error",
    "idempotency_key_required",
    "idempotency_key_reused",
    "route_not_found",
]);

/** No answer at all: no network, a dead connection, or the time limit. */
export const isConnection = (error: unknown) =>
    error instanceof TypeError || (error as Error | null)?.name === "TimeoutError";

/** Cancelled by the app itself (a screen left before its data came): nothing to tell anyone. */
export const isCancelled = (error: unknown) => {
    const name = (error as Error | null)?.name;
    return name === "AbortError" || name === "CancelledError";
};

/** An error with none of our codes: worth a report, so a generic message is never a mystery. */
export function reportUnknown(error: unknown, where: string) {
    if ((error as { code?: string } | null)?.code) return;
    const e = error as Error | null;
    void import("../lib/events").then((m) =>
        m.reportError(new Error(`${where}: ${e?.name ?? "?"}: ${e?.message ?? String(error)}`)),
    );
}

/**
 * A bug rather than something the person can act on. The safe side by default: a code the app has
 * no words for, an answer that is not ours, or Go failing, all count, so they get noticed.
 */
function isBroken(t: (key: MessageKey) => string, error: unknown): boolean {
    const e = error as { status?: number; code?: string } | null;
    if (!e?.code) return true;
    if ((e.status ?? 0) >= 500 || BROKEN.has(e.code)) return true;
    const key = `errors.${e.code}` as MessageKey;
    return t(key) === key;
}

/**
 * A save that failed: a connection that failed says so; something the person can act on is a red
 * toast saying what happened; anything else is a bug, and its sheet opens by itself, to copy and send.
 */
export function showFailure(t: (key: MessageKey) => string, error: unknown) {
    const code = (error as { code?: string } | null)?.code ?? "";
    if (QUIET.has(code) || isCancelled(error)) return;
    if (isConnection(error)) return toast(t("errors.notSavedOffline"), { kind: "warning" });
    const text = errorMessage(t, error);
    reportUnknown(error, "save");
    if (isBroken(t, error))
        return openErrorSheet({ title: t("errorSheet.title"), text, failure: failureFor(error) });
    toast(text, { kind: "error" });
}
