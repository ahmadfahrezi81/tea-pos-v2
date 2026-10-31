import { useT } from "@tea-pos/i18n/react";
import { ArrowDown, Check } from "lucide-react";
import { useEffect, useState } from "react";

import { UpdateBar, useAppUpdate } from "./AppUpdate";

// Seconds between a finished download and the reload.
const RESTART_SECONDS = 5;

/** Counts down, then reloads into the build that has finished downloading. */
function Countdown({ onDone }: { onDone: () => void }) {
    const t = useT();
    const [left, setLeft] = useState(RESTART_SECONDS);
    useEffect(() => {
        if (left === 0) return onDone();
        const timer = setTimeout(() => setLeft(left - 1), 1000);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [left]);
    return (
        <>
            <p className="min-w-0 flex-1 truncate text-sm font-semibold">
                {t("shell.updateRestartIn").replace("{n}", String(left))}
            </p>
            <button
                onClick={onDone}
                className="shrink-0 rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-gray-900 active:opacity-70"
            >
                {t("shell.updateRestart")}
            </button>
        </>
    );
}

/**
 * The update where a tab's title goes, the same height, so nothing moves. Only a tab's root shows
 * it, so the countdown, and with it the reload, waits there: never mid-form on an inner page.
 */
export function UpdateHeader() {
    const t = useT();
    const update = useAppUpdate();
    return (
        <div
            role="status"
            className="flex h-[42px] min-w-0 flex-1 items-center gap-2.5 rounded-xl bg-gray-900 px-3 text-white"
        >
            {update.phase === "ready" ? (
                <Check size={18} strokeWidth={3} className="mx-0.5 shrink-0" />
            ) : (
                <span className="update-drop relative block size-[22px] shrink-0 overflow-hidden">
                    <ArrowDown size={18} strokeWidth={2.75} className="absolute left-0.5 top-0" />
                    <span className="absolute inset-x-0.5 bottom-0 h-0.5 rounded-full bg-white" />
                </span>
            )}
            {update.phase === "ready" ? (
                <Countdown onDone={() => void update.apply()} />
            ) : (
                <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs font-semibold">
                        <span className="truncate">{t("shell.updateDownloading")}</span>
                        {update.percent !== null && <span>{update.percent}%</span>}
                    </div>
                    <UpdateBar percent={update.percent} dark />
                </div>
            )}
        </div>
    );
}
