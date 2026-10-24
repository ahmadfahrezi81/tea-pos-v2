import { api } from "@tea-pos/api-client";
import { clearCache } from "@tea-pos/api-client/query";
import type { QueryClient } from "@tanstack/react-query";

const USER_KEY = "tea-pos:user";

/** The last signed-in user on this phone; it picks whose saved cache opens. */
export function savedUser(): string | undefined {
    try {
        return localStorage.getItem(USER_KEY) ?? undefined;
    } catch {
        return undefined;
    }
}

export function rememberUser(id: string | undefined) {
    try {
        if (id) localStorage.setItem(USER_KEY, id);
        else localStorage.removeItem(USER_KEY);
    } catch {
        /* private mode: the cache just stays anonymous */
    }
}

/** Ends the session, forgets everything saved on the phone, and returns to sign-in. */
export async function signOut(queryClient: QueryClient) {
    await api.POST("/auth/logout");
    await leave(queryClient);
}

/** Ends every session of the user, in every app; their other phones go to sign-in at once (017b). */
export async function signOutEverywhere(queryClient: QueryClient) {
    await api.POST("/auth/logout-everywhere");
    await leave(queryClient);
}

async function leave(queryClient: QueryClient) {
    await clearCache(queryClient);
    rememberUser(undefined);
    window.location.assign("/login");
}
