import { localDate } from "@tea-pos/format";
import type { MessageKey } from "@tea-pos/i18n";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { ConfirmSheet } from "@tea-pos/shell/FormFooter";
import { useAccess } from "@tea-pos/shell/tenant";
import { toast } from "@tea-pos/ui/toast";
import { Callout } from "@tea-pos/ui/Callout";
import { CalendarClock, Check } from "lucide-react";
import { useState } from "react";

import { usePayPeriod, usePayWrite, writes } from "./pay";
import { daysLeft } from "./dates";
import { Skeleton } from "@tea-pos/ui/Skeleton";

type Frequency = "weekly" | "bi_weekly" | "four_weekly";
const FREQUENCIES: Frequency[] = ["weekly", "bi_weekly", "four_weekly"];
const WEEKS: Record<Frequency, number> = { weekly: 1, bi_weekly: 2, four_weekly: 4 };

const addDays = (d: string, n: number) => {
    const x = new Date(`${d}T12:00:00Z`);
    x.setUTCDate(x.getUTCDate() + n);
    return x.toISOString().slice(0, 10);
};

/** The period a day falls in, as Go and the old app count it (shown before switching, never saved). */
function windowOf(date: string, f: Frequency): [string, string] {
    if (f === "weekly") {
        const dow = new Date(`${date}T12:00:00Z`).getUTCDay() || 7;
        const mon = addDays(date, 1 - dow);
        return [mon, addDays(mon, 6)];
    }
    const days = WEEKS[f] * 7;
    const since = Math.round((Date.parse(date) - Date.parse("2025-01-06")) / 86_400_000);
    const start = addDays("2025-01-06", Math.floor(since / days) * days);
    return [start, addDays(start, days - 1)];
}

function range(start: string, end: string, locale: string) {
    const f = (d: string, o: Intl.DateTimeFormatOptions) =>
        new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-GB", {
            ...o,
            timeZone: "UTC",
        }).format(new Date(`${d}T00:00:00Z`));
    return start.slice(0, 7) === end.slice(0, 7)
        ? `${f(start, { day: "numeric" })}–${f(end, { day: "numeric", month: "short" })}`
        : `${f(start, { day: "numeric", month: "short" })} – ${f(end, { day: "numeric", month: "short" })}`;
}

/** The tenant's pay frequency: safe to change only on a period's last day, or before anything is counted into it. */
export function PaySchedule() {
    const t = useT();
    const locale = useLocale();
    const { data: p } = usePayPeriod();
    const [pending, setPending] = useState<Frequency | null>(null);
    const save = usePayWrite(writes.setSchedule);
    const { canWrite } = useAccess();
    if (!p) return <Skeleton className="h-40 rounded-2xl" />;
    const current = p.frequency;
    const left = daysLeft(p.end, localDate());
    const name = (f: Frequency) => t(`pay.cadence.${f}` as MessageKey);
    // A change applies from the next period, so each option is shown from the day this one ends.
    const nextStart = p.payoutDate;
    const next = (f: Frequency) => {
        const [start, end] = windowOf(nextStart, f);
        return { start, end, aligned: start === nextStart };
    };
    const safe = left <= 0 || p.payouts === 0;
    const message = (f: Frequency) => {
        const n = next(f);
        let m = t("pay.switchNext").replace("{range}", range(n.start, n.end, locale)) + " ";
        m +=
            p.payouts === 0
                ? t("pay.switchClean")
                : left <= 0
                  ? t("pay.switchLastDay")
                  : t("pay.switchCounted")
                        .replace("{n}", String(p.payouts))
                        .replace("{days}", String(left));
        if (!n.aligned) m += " " + t("pay.switchOverlap");
        return m;
    };
    return (
        <div className="space-y-4">
            <div className="bg-white p-3 rounded-2xl flex items-center gap-3">
                <div className="size-11 rounded-xl bg-brand/10 flex items-center justify-center shrink-0">
                    <CalendarClock size={24} className="text-brand" />
                </div>
                <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-500">
                        {t("pay.currentPeriod")} · {name(current)}
                    </p>
                    <p className="font-mono text-sm font-semibold text-gray-600">
                        {range(p.start, p.end, locale)}{" "}
                        <span className="text-gray-900 font-bold">
                            (
                            {left <= 0
                                ? t("pay.lastDay")
                                : t("pay.daysLeft").replace("{n}", String(left))}
                            )
                        </span>
                    </p>
                </div>
            </div>
            {/* The rule that keeps a switch safe, where the switch happens. */}
            {!safe && (
                <Callout title={t("pay.notTheDay")}>
                    {t("pay.notTheDaySub")
                        .replace("{n}", String(p.payouts))
                        .replace("{days}", String(left))}
                </Callout>
            )}
            <div className="bg-white rounded-2xl overflow-hidden">
                {FREQUENCIES.map((f, i) => {
                    const isCurrent = f === current;
                    const n = next(f);
                    return (
                        <button
                            key={f}
                            disabled={isCurrent}
                            onClick={() => canWrite && setPending(f)}
                            className={`w-full flex items-center justify-between gap-3 p-4 text-left ${i > 0 ? "border-t border-gray-100" : ""} ${isCurrent ? "" : "active:bg-gray-50"}`}
                        >
                            <div className="min-w-0">
                                <p
                                    className={`text-base font-semibold ${isCurrent ? "text-brand" : "text-gray-900"}`}
                                >
                                    {name(f)}
                                </p>
                                <p className="text-xs text-gray-500">
                                    {t(`pay.cadenceSub.${f}` as MessageKey)}
                                </p>
                                <p className="font-mono text-xs text-gray-400 mt-0.5">
                                    {t("pay.next")}: {range(n.start, n.end, locale)}
                                    {!n.aligned && " ⚠"}
                                </p>
                            </div>
                            {isCurrent && <Check size={18} className="text-brand shrink-0" />}
                        </button>
                    );
                })}
            </div>
            <p className="text-xs text-gray-400 px-1">{t("pay.scheduleNote")}</p>
            {pending && (
                <ConfirmSheet
                    title={t("pay.switchTo").replace("{name}", name(pending))}
                    message={message(pending)}
                    emoji="alarmClock"
                    label={t("pay.switch")}
                    busyLabel={t("pay.saving")}
                    onConfirm={async () => {
                        await save.mutateAsync({ frequency: pending });
                        toast(t("pay.scheduleSet").replace("{name}", name(pending)));
                        setPending(null);
                    }}
                    onError={() => setPending(null)}
                    onCancel={() => setPending(null)}
                />
            )}
        </div>
    );
}
