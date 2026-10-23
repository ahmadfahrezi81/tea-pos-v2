import type { QueryClient } from "@tanstack/react-query";

import { navProgress } from "./navProgress";

/** Holds the loading bar until a new screen's first requests have answered. */
export function trackFirstLoads(queryClient: QueryClient) {
    const cache = queryClient.getQueryCache();
    return cache.subscribe((event) => {
        if (event.type !== "updated" || event.action.type !== "fetch") return;
        if (event.query.state.data !== undefined) return;
        const query = event.query;
        navProgress.track(
            new Promise<void>((resolve) => {
                const off = cache.subscribe((e) => {
                    if (e.query !== query) return;
                    // Removed before it answered still ends the wait.
                    if (e.type !== "removed" && query.state.fetchStatus !== "idle") return;
                    off();
                    resolve();
                });
            }),
        );
    });
}
