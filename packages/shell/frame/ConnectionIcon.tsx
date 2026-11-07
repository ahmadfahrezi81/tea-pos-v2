import { $api } from "@tea-pos/api-client";
import { useConnection } from "@tea-pos/api-client/connection";
import { formatTime } from "@tea-pos/format";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { Sheet } from "@tea-pos/ui/Sheet";
import { toast } from "@tea-pos/ui/toast";
import { WifiLow, WifiOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Beside the avatar, only when something is wrong: no network (red), or the server not answering
 * (amber). A tap says more. Going offline is said once in a toast; coming back is quiet.
 */
export function ConnectionIcon() {
    const t = useT();
    const locale = useLocale();
    const { state, since, lastAnswerAt } = useConnection();
    // Open for this trouble only: the next one starts closed.
    const [openFor, setOpenFor] = useState(0);
    const open = openFor === since && since > 0;
    const was = useRef(state);
    const health = $api.useQuery("get", "/health", {}, { enabled: false, retry: false });

    useEffect(() => {
        if (state === "offline" && was.current !== "offline")
            toast(t("connection.offlineToast"), { kind: "warning" });
        was.current = state;
    }, [state, t]);

    if (state === "online") return null;
    const offline = state === "offline";
    const Icon = offline ? WifiOff : WifiLow;
    return (
        <>
            <button
                onClick={() => setOpenFor(since)}
                aria-label={t("connection.label")}
                className={`flex size-[42px] shrink-0 items-center justify-center rounded-xl active:scale-95 ${offline ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"}`}
            >
                <Icon size={22} strokeWidth={2.5} />
            </button>
            <Sheet
                open={open}
                onClose={() => setOpenFor(0)}
                title={t(offline ? "connection.offlineTitle" : "connection.slowTitle")}
            >
                <div className="space-y-4 pb-2">
                    <div className="flex justify-center py-2">
                        <div className="flex size-24 items-center justify-center rounded-full bg-gray-100">
                            <Icon size={44} className="text-gray-400" />
                        </div>
                    </div>
                    <p className="text-base text-gray-900">
                        {t(offline ? "connection.offlineBody" : "connection.slowBody")}
                    </p>
                    <div className="rounded-xl bg-slate-100 px-3 py-1 divide-y divide-slate-200 text-sm">
                        <div className="flex justify-between gap-3 py-2">
                            <span className="text-gray-700">{t("connection.since")}</span>
                            <span className="text-gray-900">
                                {formatTime(new Date(since).toISOString(), locale)}
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
