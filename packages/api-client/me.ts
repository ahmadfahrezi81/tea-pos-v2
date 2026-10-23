import { useQuery } from "@tanstack/react-query";

import { api, type components } from "./index";
import { STALE } from "./query";

export type Me = components["schemas"]["Me"];

declare global {
    /** Started by index.html before any JavaScript loads (packages/config/vite.ts). */
    var __me: Promise<Response | null> | undefined;
}

export const ME_KEY = ["me"] as const;

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
    const { data, error } = await api.GET("/me");
    if (error) throw new Error(error.code ?? "me failed");
    return data;
}

/** Who is signed in, their tenants and stores; saved on the phone, so a reopen draws it at once. */
export function useMe() {
    return useQuery({
        queryKey: ME_KEY,
        queryFn: fetchMe,
        staleTime: STALE.COOL,
        // The early request is already paid for: always take it, even over a fresh saved copy.
        refetchOnMount: () => (globalThis.__me ? "always" : true),
    });
}
