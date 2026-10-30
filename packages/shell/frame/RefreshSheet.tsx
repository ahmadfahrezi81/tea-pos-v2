import { useQueryClient } from "@tanstack/react-query";
import { useT } from "@tea-pos/i18n/react";
import { Emoji } from "@tea-pos/ui/Emoji";
import { DOT_GRID } from "@tea-pos/ui/dot-grid";
import { Info, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { navProgress } from "./navProgress";
import { refreshGate } from "./refreshGate";
import { UpdateBar, useAppUpdate } from "./AppUpdate";
import { Drawer } from "@tea-pos/ui/Drawer";

const INACTIVITY_LIMIT = 1000 * 60 * 20; // 20 minutes

// The only timer ticking on every screen, so a coarse one.
const IDLE_CHECK_MS = 1000 * 10;

// Two reasons, one sheet: two popups racing each other would be worse.
const COPY = {
    update: { emoji: "sparkles", key: "shell.update" },
    inactivity: { emoji: "refresh", key: "shell.inactivity" },
} as const;

// pointerdown covers touch, so a tap or a scroll counts as activity on a phone.
const ACTIVITY_EVENTS = ["pointerdown", "mousemove", "keydown"] as const;

/** The update sheet and the idle sheet, for every app. */
export function RefreshSheet() {
    const t = useT();
    const queryClient = useQueryClient();
    const [showInactivityPrompt, setShowInactivityPrompt] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
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

    // An update outranks inactivity.
    const reason = update.phase === "ready" ? "update" : showInactivityPrompt ? "inactivity" : null;

    // An update needs new code, so a reload. Inactivity only needs fresh data: a
    // refetch in place, so the POS cart (held in memory) survives.
    const handleRefresh = () => {
        if (reason === "update") {
            setIsRefreshing(true);
            void update.apply();
            return;
        }

        setShowInactivityPrompt(false);
        lastActivityRef.current = Date.now();
        // Marked so a pull right after does not refetch the same; never gated itself.
        refreshGate.mark();
        // A failed refetch leaves the old data on screen.
        navProgress.run(queryClient.invalidateQueries().catch(() => {}));
    };

    // Clears the idle flag too, or dismissing an update swapped in the idle sheet.
    const handleDismiss = () => {
        if (reason === "update") update.later();
        setShowInactivityPrompt(false);
        lastActivityRef.current = Date.now();
    };

    const toast = (update.phase === "downloading" || update.phase === "stuck") && (
        <div
            role="status"
            className="pointer-events-auto fixed inset-x-0 top-[calc(env(safe-area-inset-top)+8px)] z-50 mx-auto w-[calc(100%-24px)] max-w-[456px] rounded-xl bg-gray-900 px-3 py-2 text-white shadow-lg animate-drop-in"
        >
            {update.phase === "stuck" ? (
                <div className="flex items-center justify-between gap-3 text-sm font-semibold">
                    <span>{t("shell.updateFailed")}</span>
                    <button onClick={update.retry} className="underline active:opacity-70">
                        {t("shell.updateRetry")}
                    </button>
                </div>
            ) : (
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3 text-sm font-semibold">
                        <span>{t("shell.updateDownloading")}</span>
                        {update.percent !== null && <span>{update.percent}%</span>}
                    </div>
                    <UpdateBar percent={update.percent} dark />
                </div>
            )}
        </div>
    );

    if (!reason) return toast || null;
    const { emoji, key } = COPY[reason];

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
                <Emoji name={emoji} size={88} className="relative" />
            </div>

            <div className="space-y-1 text-center">
                <p className="text-xl font-bold text-gray-900">{t(`${key}.title`)}</p>
                <p className="text-sm text-gray-600">{t(`${key}.body`)}</p>
            </div>

            <div className="flex items-start gap-3 rounded-xl bg-gray-50 p-4 text-left">
                <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                    <Info size={18} className="text-blue-500" />
                </div>
                <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-gray-900">{t(`${key}.infoTitle`)}</p>
                    <p className="text-sm text-gray-500">{t(`${key}.infoBody`)}</p>
                </div>
            </div>

            <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-brand text-white font-semibold text-base active:scale-[0.98] transition-transform disabled:opacity-60"
            >
                <RefreshCw size={18} className={isRefreshing ? "animate-spin" : ""} />
                {t(isRefreshing ? "shell.refreshing" : "shell.refreshNow")}
            </button>
        </Drawer>
    );
}
