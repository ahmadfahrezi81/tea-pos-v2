import { $api } from "@tea-pos/api-client";
import { networkKind, useConnection, type Level } from "@tea-pos/api-client/connection";
import { formatTime } from "@tea-pos/format";
import type { MessageKey } from "@tea-pos/i18n";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { Sheet } from "@tea-pos/ui/Sheet";
import { toast } from "@tea-pos/ui/toast";
import { Wifi, WifiHigh, WifiLow, WifiOff, WifiZero, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// As the title while all is well; amber or red only when it matters.
const LOOK: Record<Level, [LucideIcon, string]> = {
    good: [Wifi, "text-gray-900"],
    okay: [WifiHigh, "text-gray-900"],
    slow: [WifiLow, "text-amber-500"],
    failing: [WifiZero, "text-amber-500"],
    offline: [WifiOff, "text-red-600"],
};

/**
 * Beside the avatar, always: how well the phone reaches the server, as a phone's own wifi bars,
 * from the requests the app makes anyway. A tap says more. Going offline is said once in a toast.
 */
export function ConnectionIcon() {
    const t = useT();
    const locale = useLocale();
    const { level, lastAnswerAt, ms } = useConnection();
    const [open, setOpen] = useState(false);
    const was = useRef(level);
    const health = $api.useQuery("get", "/health", {}, { enabled: false, retry: false });

    useEffect(() => {
        if (level === "offline" && was.current !== "offline")
            toast(t("connection.offlineToast"), { kind: "warning" });
        was.current = level;
    }, [level, t]);

    const [Icon, color] = LOOK[level];
    const kind = networkKind();
    const meaning: MessageKey | null =
        level === "offline"
            ? "connection.offlineBody"
            : level === "failing" || level === "slow"
              ? "connection.slowBody"
              : null;
    return (
        <>
            <button
                onClick={() => setOpen(true)}
                aria-label={t("connection.label")}
                className={`flex size-[42px] shrink-0 items-center justify-center rounded-xl active:scale-95 ${color}`}
            >
                <Icon size={28} strokeWidth={2.5} />
            </button>
            <Sheet open={open} onClose={() => setOpen(false)} title={t("connection.label")}>
                <div className="space-y-4 pb-2">
                    <div className="flex flex-col items-center gap-2 py-2">
                        <div className="flex size-24 items-center justify-center rounded-full bg-gray-100">
                            <Icon size={44} className={color} />
                        </div>
                        <p className="text-lg font-bold text-gray-900">
                            {t(`connection.${level}`)}
                        </p>
                    </div>
                    {meaning && <p className="text-base text-gray-900">{t(meaning)}</p>}
                    <div className="rounded-xl bg-slate-100 px-3 py-1 divide-y divide-slate-200 text-sm">
                        <div className="flex justify-between gap-3 py-2">
                            <span className="text-gray-700">{t("connection.answersIn")}</span>
                            <span className="text-gray-900">
                                {ms === undefined ? t("connection.never") : `~${ms} ms`}
                            </span>
                        </div>
                        <div className="flex justify-between gap-3 py-2">
                            <span className="text-gray-700">{t("connection.lastAnswer")}</span>
                            <span className="text-gray-900">
                                {lastAnswerAt
                                    ? formatTime(new Date(lastAnswerAt).toISOString(), locale)
                                    : t("connection.never")}
                            </span>
                        </div>
                        {kind && (
                            <div className="flex justify-between gap-3 py-2">
                                <span className="text-gray-700">{t("connection.network")}</span>
                                <span className="text-gray-900 uppercase">{kind}</span>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={() => void health.refetch()}
                        disabled={health.isFetching}
                        className="w-full rounded-xl bg-brand py-3.5 font-semibold text-white active:opacity-80 disabled:opacity-60"
                    >
                        {t("connection.tryAgain")}
                    </button>
                </div>
            </Sheet>
        </>
    );
}
