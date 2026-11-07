import { useQuery } from "@tanstack/react-query";

import { api, type components } from "./index";
import { retry, STALE } from "./query";

export type Me = components["schemas"]["Me"];

declare global {
    /** Started by index.html before any JavaScript loads (packages/config/vite.ts). */
    var __me: Promise<Response | null> | undefined;
}

export const ME_KEY = ["me"] as const;

/** A /me that has not answered by now is stuck (a phone waking on a dead connection), not slow. */
export const ME_TIMEOUT_MS = 15_000;

/** The first load takes the request index.html already started; later ones ask again. */
async function fetchMe(): Promise<Me> {
    const early = globalThis.__me;
    globalThis.__me = undefined;
    const response = early ? await early : null;
    if (response?.ok) return (await response.json()) as Me;
    if (response?.status === 401) {
        window.location.assign("/login");
        throw new Error("not signed in");
    }
    // Signed in, but Go refuses this user in this app (inactive, no access) and has ended the session.
    const refused = () => {
        window.location.assign("/login?error=not_allowed");
        return new Error("not_allowed");
    };
    if (response?.status === 403) throw refused();
    const { data, error } = await api.GET("/me", { signal: AbortSignal.timeout(ME_TIMEOUT_MS) });
    if (error?.code === "not_allowed") throw refused();
    if (error) throw new Error(error.code ?? "me failed");
    return data;
}

/** Who is signed in, their tenants and stores; saved on the phone, so a reopen draws it at once. */
export function useMe() {
    return useQuery({
        queryKey: ME_KEY,
        queryFn: fetchMe,
        staleTime: STALE.COOL,
        // A timeout shows the retry screen at once: three more would hold the splash a minute.
        retry: (count, error) =>
            (error as Error | null)?.name !== "TimeoutError" && retry(count, error),
        // The early request is already paid for: always take it, even over a fresh saved copy.
        refetchOnMount: () => (globalThis.__me ? "always" : true),
    });
}
