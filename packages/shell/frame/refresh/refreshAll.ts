import type { QueryClient } from "@tanstack/react-query";

import { navProgress } from "../navProgress";
import { refreshGate } from "./refreshGate";

/**
 * Refetches the screens on view in place, under the header's bar; the POS cart (in memory) survives.
 * Unless `always`, skipped right after another full refetch, so coming back and the socket's
 * catch-up ask once.
 */
export function refreshAll(queryClient: QueryClient, always = false) {
    if (!always && !refreshGate.shouldFetch()) return;
    refreshGate.mark();
    // A failed refetch leaves the old data on screen.
    navProgress.run(queryClient.invalidateQueries({ refetchType: "active" }).catch(() => {}));
}
