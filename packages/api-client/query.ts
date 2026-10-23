import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryClient } from "@tanstack/react-query";
import { clear, del, get, set } from "idb-keyval";

export { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";

/**
 * How long a screen's data counts as fresh. A hook names a tier only when it
 * leaves the default (WARM), so a reviewer sees a decision, not a copied number.
 */
export const STALE = {
    /** A list that moves while someone watches it. */
    HOT: 5_000,
    /** A queue someone is working through. */
    QUICK: 10_000,
    /** The default. Today's orders and today's summary sit here. */
    WARM: 30_000,
    /** Changes a few times a day. */
    COOL: 60_000,
    /** Configuration: changes when an admin decides it does. */
    COLD: 300_000,
    /** A closed month cannot change. */
    STATIC: 900_000,
} as const;

const DAY = 24 * 60 * 60 * 1000;

export function createQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: STALE.WARM,
                // Kept as long as the saved copy, or a cold open would find nothing to draw.
                gcTime: DAY,
                refetchOnWindowFocus: false,
                retry: 3,
            },
        },
    });
}

/**
 * The saved cache is kept per user and tenant, so a phone handed to another
 * staff member never shows the previous person's data. No user before sign-in.
 */
export function cacheKey(userId?: string, tenantId?: string): string {
    return userId ? `tq:${userId}:${tenantId ?? "none"}` : "tq:anon";
}

/** The query cache saved in IndexedDB, so a cold open draws the last data at once. */
export function createPersister(key: string) {
    return createAsyncStoragePersister({
        storage: { getItem: get, setItem: set, removeItem: del },
        key,
        throttleTime: 1000,
    });
}

/** Saved copies older than this are dropped. */
export const CACHE_MAX_AGE = DAY;

/** On logout: forget everything, in memory and on the phone, for every user. */
export async function clearCache(queryClient: QueryClient) {
    queryClient.clear();
    await clear();
}
