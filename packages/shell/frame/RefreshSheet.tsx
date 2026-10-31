import { useQueryClient } from "@tanstack/react-query";
import { useT } from "@tea-pos/i18n/react";
import { Emoji } from "@tea-pos/ui/Emoji";
import { DOT_GRID } from "@tea-pos/ui/dot-grid";
import { Info, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { navProgress } from "./navProgress";
import { refreshGate } from "./refreshGate";
import { useAppUpdate } from "./AppUpdate";
import { Drawer } from "@tea-pos/ui/Drawer";

const INACTIVITY_LIMIT = 1000 * 60 * 20; // 20 minutes

// The only timer ticking on every screen, so a coarse one.
const IDLE_CHECK_MS = 1000 * 10;

// pointerdown covers touch, so a tap or a scroll counts as activity on a phone.
const ACTIVITY_EVENTS = ["pointerdown", "mousemove", "keydown"] as const;

/** The idle sheet, for every app. */
export function RefreshSheet() {
    const t = useT();
    const queryClient = useQueryClient();
    const [showInactivityPrompt, setShowInactivityPrompt] = useState(false);
    const update = useAppUpdate();
    // A ref: activity fires constantly and must not re-render.
    const lastActivityRef = useRef(0);

    useEffect(() => {
        const markActive = () => {
            lastActivityRef.current = Date.now();
        };

        // Mounting counts as activity.
        markActive();

        ACTIVITY_EVENTS.forEach((event) =>
            window.addEventListener(event, markActive, { passive: true }),
        );

        return () => {
            ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, markActive));
        };
    }, []);

    useEffect(() => {
        const interval = setInterval(() => {
            if (Date.now() - lastActivityRef.current > INACTIVITY_LIMIT) {
                setShowInactivityPrompt(true);
            }
        }, IDLE_CHECK_MS);

        return () => clearInterval(interval);
    }, []);

    // Inactivity only needs fresh data: a refetch in place, so the POS cart (held in memory) survives.
    const handleRefresh = () => {
        setShowInactivityPrompt(false);
        lastActivityRef.current = Date.now();
        // Marked so a pull right after does not refetch the same; never gated itself.
        refreshGate.mark();
        // A failed refetch leaves the old data on screen.
        navProgress.run(queryClient.invalidateQueries().catch(() => {}));
    };

    const handleDismiss = () => {
        setShowInactivityPrompt(false);
        lastActivityRef.current = Date.now();
    };

    if (!showInactivityPrompt || update.phase === "ready") return null;

    return (
        <Drawer onClose={handleDismiss} dim="bg-black/40" className="px-5 pt-5 pb-2.5 space-y-4">
            <div className="flex justify-center">
                <div className="w-8 h-1 rounded-full bg-gray-300" />
            </div>

            <div className="relative -mx-5 flex justify-center py-3">
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0"
                    style={DOT_GRID}
                />
                <Emoji name="refresh" size={88} className="relative" />
            </div>

            <div className="space-y-1 text-center">
                <p className="text-xl font-bold text-gray-900">{t("shell.inactivity.title")}</p>
                <p className="text-sm text-gray-600">{t("shell.inactivity.body")}</p>
            </div>

            <div className="flex items-start gap-3 rounded-xl bg-gray-50 p-4 text-left">
                <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                    <Info size={18} className="text-blue-500" />
                </div>
                <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-gray-900">
                        {t("shell.inactivity.infoTitle")}
                    </p>
                    <p className="text-sm text-gray-500">{t("shell.inactivity.infoBody")}</p>
                </div>
            </div>

            <button
                onClick={handleRefresh}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-brand text-white font-semibold text-base active:scale-[0.98] transition-transform"
            >
                <RefreshCw size={18} />
                {t("shell.refreshNow")}
            </button>
        </Drawer>
    );
}
