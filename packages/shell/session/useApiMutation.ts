import { useT } from "@tea-pos/i18n/react";
import { useMutation, type UseMutationOptions } from "@tanstack/react-query";
import { useRef } from "react";

import { showFailure } from "./failed";

/** Tried again only when the answer may change: no connection, or Go failing (5xx). */
function retry(count: number, error: unknown): boolean {
    const status = (error as { status?: number } | null)?.status ?? 0;
    return count < 3 && (error instanceof TypeError || status >= 500);
}

/**
 * A write from a screen: one Idempotency-Key per action, kept across its retries, so Go saves
 * it once however often a slow connection makes it resend (017e); its error shown (`showFailure`)
 * unless the screen handles it (`onError`). Offline, React Query holds it until the phone is back.
 */
export function useApiMutation<TData, TVars extends object>(
    write: (vars: TVars, headers: { "Idempotency-Key": string }) => Promise<TData>,
    options: Omit<UseMutationOptions<TData, unknown, TVars>, "mutationFn"> = {},
) {
    const t = useT();
    // One key per mutate(vars) call: React Query's retries of that call pass the same vars
    // object, so they reuse it.
    const keys = useRef(new WeakMap<object, string>());
    return useMutation<TData, unknown, TVars>({
        retry,
        ...options,
        mutationFn: (vars: TVars) => {
            let key = keys.current.get(vars);
            if (!key) keys.current.set(vars, (key = crypto.randomUUID()));
            return write(vars, { "Idempotency-Key": key });
        },
        onError: options.onError ?? ((error) => showFailure(t, error)),
    });
}
