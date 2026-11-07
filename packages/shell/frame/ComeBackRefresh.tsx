import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { useAppUpdate } from "./AppUpdate";
import { refreshAll } from "./refreshAll";

/** Away this long (the live socket closes after the same): coming back refetches. */
const AWAY_MS = 60_000;
/** Open but untouched this long (a dashboard on a table): refetches too. */
const IDLE_MS = 20 * 60_000;
const IDLE_CHECK_MS = 10_000;
// pointerdown covers touch, so a tap or a scroll counts as activity on a phone.
const ACTIVITY_EVENTS = ["pointerdown", "keydown"] as const;

/** Keeps a screen left open or come back to fresh, under the header loader. Draws nothing. */
export function ComeBackRefresh() {
    const queryClient = useQueryClient();
    const { phase } = useAppUpdate();
    const updating = phase === "ready";

    useEffect(() => {
        // About to reload into a new build: nothing to refetch.
        if (updating) return;
        let lastActive = Date.now();
        let hiddenAt = 0;
        const refresh = () => {
            lastActive = Date.now();
            // A phone's clock for the gate may stop while asleep: away long enough always asks.
            refreshAll(queryClient, true);
        };
        const markActive = () => {
            lastActive = Date.now();
        };
        const onVisibility = () => {
            if (document.visibilityState === "hidden") {
                hiddenAt = Date.now();
                return;
            }
            const away = hiddenAt ? Date.now() - hiddenAt : 0;
            hiddenAt = 0;
            if (away >= AWAY_MS) refresh();
        };
        const idle = setInterval(() => {
            if (document.visibilityState === "visible" && Date.now() - lastActive > IDLE_MS)
                refresh();
        }, IDLE_CHECK_MS);
        ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, markActive, { passive: true }));
        document.addEventListener("visibilitychange", onVisibility);
        return () => {
            clearInterval(idle);
            ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, markActive));
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, [queryClient, updating]);

    return null;
}
