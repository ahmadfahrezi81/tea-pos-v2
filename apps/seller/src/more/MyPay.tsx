import { LoadFailed } from "@tea-pos/shell/LoadFailed";
import type { components } from "@tea-pos/api-client";
import {
    addDays,
    formatCalendarDay,
    formatDateTime,
    formatMoney,
    formatMonth,
    weeks,
} from "@tea-pos/format";
import type { MessageKey } from "@tea-pos/i18n";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { useSlug } from "@tea-pos/shell/tenant";
import { CopyButton } from "@tea-pos/ui/CopyButton";
import { ImagePreview } from "@tea-pos/ui/ImagePreview";
import { Skeleton } from "@tea-pos/ui/Skeleton";
import { Link } from "@tanstack/react-router";
import { CalendarClock, CalendarDays } from "lucide-react";
import { useState } from "react";

import { useMyPay, useMyPayslip } from "./mine";

const STATUS = {
    pending: "bg-yellow-100 text-yellow-700",
    paid: "bg-green-100 text-green-700",
    skipped: "bg-gray-200 text-gray-600",
} as const;

const STATUS_WORD = {
    pending: "earnings.statusOngoing",
    paid: "earnings.statusPaid",
    skipped: "earnings.statusSkipped",
} as const satisfies Record<string, MessageKey>;

const FREQUENCY: Record<string, MessageKey> = {
    weekly: "earnings.freqWeekly",
    bi_weekly: "earnings.freqBiWeekly",
    four_weekly: "earnings.freqFourWeekly",
};

const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

/** My Pay: how the seller is paid, then their periods by year and month. */
export function MyPay() {
    const t = useT();
    const locale = useLocale();
    const { data, error } = useMyPay();
    const [picked, setPicked] = useState<number>();
    if (error && !data) return <LoadFailed error={error} />;
    if (!data)
        return (
            <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                    <Skeleton key={i} delay={i * 80} className="h-24 rounded-2xl" />
                ))}
            </div>
        );
    const years = [...new Set(data.payouts.map((p) => +p.start.slice(0, 4)))].sort((a, b) => b - a);
    const year = picked ?? years[0] ?? new Date().getFullYear();
    const months = new Map<string, typeof data.payouts>();
    for (const p of data.payouts.filter((p) => +p.start.slice(0, 4) === year)) {
        const key = p.start.slice(0, 7);
        months.set(key, [...(months.get(key) ?? []), p]);
    }
    const frequency = FREQUENCY[data.payFrequency];
    const row = (label: string, value: string) => (
        <div className="flex justify-between items-center" key={label}>
            <span className="text-gray-500">{label}</span>
            <span className="font-medium text-gray-800">{value}</span>
        </div>
    );
    return (
        <div className="space-y-4">
            <div className="bg-white p-3 rounded-2xl flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-brand/10 flex items-center justify-center shrink-0">
                    <CalendarClock size={24} className="text-brand" />
                </div>
                <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-500">
                        {t("earnings.nextExpectedPayout")}
                    </p>
                    <p className="text-lg font-bold text-gray-900">
                        {formatCalendarDay(data.nextPayout, locale, "full")}
                    </p>
                </div>
            </div>
            <div className="bg-white p-4 rounded-2xl space-y-2 text-sm">
                <h3 className="font-semibold text-gray-800">{t("earnings.payConfig")}</h3>
                {row(t("earnings.payFrequency"), frequency ? t(frequency) : "—")}
                {row(
                    t("earnings.perCupLabel"),
                    data.ratePerCup === null ? "—" : formatMoney(data.ratePerCup),
                )}
                <div className="flex justify-between items-center">
                    <span className="text-gray-500">{t("earnings.commissionConfig")}</span>
                    <div className="flex items-center gap-1">
                        <span className="font-medium text-gray-800">{data.slug || "—"}</span>
                        {data.slug && (
                            <CopyButton value={data.slug} label={t("earnings.commissionConfig")} />
                        )}
                    </div>
                </div>
            </div>
            <div className="bg-white p-4 rounded-2xl">
                <label className="block text-sm font-medium text-gray-700">
                    <CalendarDays size={16} className="inline mr-1" />
                    {t("earnings.selectYear")}
                    <select
                        value={year}
                        onChange={(e) => setPicked(Number(e.target.value))}
                        className="mt-2 w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand/90 focus:outline-none bg-white text-gray-800"
                    >
                        {(years.length ? years : [year]).map((y) => (
                            <option key={y} value={y}>
                                {y}
                            </option>
                        ))}
                    </select>
                </label>
            </div>
            {months.size === 0 ? (
                <p className="text-center text-gray-400 py-10 text-base">
                    {t("earnings.noPeriods")}
                </p>
            ) : (
                [...months].map(([month, payouts]) => (
                    <div key={month} className="space-y-2">
                        <p className="px-1 text-lg font-semibold text-gray-800">
                            {formatMonth(`${month}-01`, locale)}
                        </p>
                        {payouts.map((p) => (
                            <PayoutRow key={p.id} payout={p} />
                        ))}
                    </div>
                ))
            )}
        </div>
    );
}

function PayoutRow({ payout: p }: { payout: components["schemas"]["Payout"] }) {
    const t = useT();
    const locale = useLocale();
    const slug = useSlug();
    const reviewed = p.approved + p.pending;
    const tile = (label: string, value: string, tone: string, wide = false) => (
        <div className={`${tone.split(" ")[0]} p-2 rounded-lg ${wide ? "col-span-2" : ""}`}>
            <p className="text-xs font-semibold text-gray-500">{label}</p>
            <p className={`text-lg font-bold ${tone.split(" ")[1]}`}>{value}</p>
        </div>
    );
    return (
        <Link
            to="/$tenant/more/earnings/$payoutId"
            params={{ tenant: slug, payoutId: p.id }}
            className="block w-full bg-white rounded-2xl p-3 text-left active:bg-gray-50 space-y-3"
        >
            <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                    <p className="text-lg font-bold text-gray-900">
                        {weeks(p.start, p.end, t("earnings.week"))}
                    </p>
                    <p className="text-sm text-gray-500">
                        {formatCalendarDay(p.start, locale, "short")} –{" "}
                        {formatCalendarDay(p.end, locale, "short")}
                    </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                    <span
                        className={`text-sm font-medium px-2 py-0.5 rounded-full ${STATUS[p.status]}`}
                    >
                        {t(STATUS_WORD[p.status])}
                    </span>
                    {reviewed > 0 && (
                        <span className="text-xs font-medium text-gray-500">
                            {p.approved} / {reviewed} {t("earnings.approvedSuffix")}
                        </span>
                    )}
                </div>
            </div>
            <div className="bg-slate-50 rounded-xl p-2 grid grid-cols-4 gap-2">
                {tile(t("analytics.orders"), String(p.orders), "bg-orange-100 text-orange-600")}
                {tile(t("analytics.cups"), String(p.cups), "bg-blue-100 text-blue-600")}
                {tile(
                    t("earnings.commissionsRow"),
                    formatMoney(p.commissions),
                    "bg-teal-100 text-teal-600",
                    true,
                )}
                {tile(
                    t("earnings.claimsRow"),
                    formatMoney(p.claims),
                    "bg-purple-100 text-purple-600",
                    true,
                )}
                {tile(
                    t("earnings.totalRow"),
                    formatMoney(p.total),
                    "bg-green-100 text-green-600",
                    true,
                )}
            </div>
        </Link>
    );
}

/** One period: the totals, the payment details, the days worked and each day's rows. Only to read. */
export function MyPayslip({ id }: { id: string }) {
    const t = useT();
    const locale = useLocale();
    const { data: slip, error } = useMyPayslip(id);
    const [proof, setProof] = useState(false);
    if (error)
        return <p className="text-center text-gray-400 py-10">{t("earnings.periodNotFound")}</p>;
    if (!slip)
        return (
            <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                    <Skeleton key={i} delay={i * 80} className="h-24 rounded-2xl" />
                ))}
            </div>
        );
    const days = Math.round((Date.parse(slip.end) - Date.parse(slip.start)) / 86_400_000) + 1;
    const period = Array.from({ length: days }, (_, i) => addDays(slip.start, i));
    const worked = new Set(slip.commissionRows.map((c) => c.date));
    const dates = [...new Set([...slip.commissionRows, ...slip.claimRows].map((r) => r.date))].sort(
        (a, b) => b.localeCompare(a),
    );
    const row = (label: string, value: string, tone = "font-medium text-gray-800") => (
        <div className="flex justify-between items-center" key={label}>
            <span className="text-gray-500">{label}</span>
            <span className={tone}>{value}</span>
        </div>
    );
    const amount = (status: string, money: number) => (
        <div className="flex items-center gap-1.5 shrink-0">
            {status === "rejected" && (
                <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">
                    {t("claims.statusRejected")}
                </span>
            )}
            <span
                className={`font-medium ${status === "rejected" ? "text-base text-red-400 line-through" : status === "pending" ? "text-xs text-gray-800" : "text-base text-gray-800"}`}
            >
                {status === "pending" ? t("earnings.pendingReview") : formatMoney(money)}
            </span>
        </div>
    );
    return (
        <div className="space-y-3 pb-24">
            <div className="bg-white p-4 rounded-2xl">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-800">
                        {weeks(slip.start, slip.end, t("earnings.week"))}
                    </h3>
                    <span
                        className={`px-2 py-0.5 rounded-full text-sm font-medium ${STATUS[slip.status]}`}
                    >
                        {t(STATUS_WORD[slip.status])}
                    </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                    <div className="text-center">
                        <p className="text-xl font-bold text-orange-600">{slip.orders}</p>
                        <p className="text-sm text-gray-600">{t("analytics.orders")}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-xl font-bold text-blue-600">{slip.cups}</p>
                        <p className="text-sm text-gray-600">{t("analytics.cups")}</p>
                    </div>
                    <div className="text-center col-span-2 border-l-2 border-gray-300">
                        <p className="text-sm text-gray-600">{t("earnings.totalRow")}</p>
                        <p className="text-xl font-bold text-green-600">
                            {formatMoney(slip.total)}
                        </p>
                    </div>
                </div>
            </div>

            <div className="bg-white p-4 rounded-2xl space-y-2 text-sm">
                <h3 className="text-sm font-semibold text-gray-800">
                    {t("earnings.paymentDetails")}
                </h3>
                {row(t("earnings.payrollFrom"), formatCalendarDay(slip.start, locale, "full"))}
                {row(t("earnings.payrollTo"), formatCalendarDay(slip.end, locale, "full"))}
                {row(
                    t("earnings.expectedPayout"),
                    formatCalendarDay(addDays(slip.end, 1), locale, "full"),
                    "font-semibold text-blue-600",
                )}
                {row(
                    t("earnings.perCupLabel"),
                    slip.ratePerCup > 0 ? formatMoney(slip.ratePerCup) : "—",
                )}
                <div className="flex justify-between items-center pt-1.5 border-t border-gray-100">
                    <span className="text-gray-500">{t("earnings.payslipId")}</span>
                    <div className="flex items-center gap-1">
                        <span className="font-mono text-xs text-gray-400">
                            {slip.id.slice(0, 8)}…
                        </span>
                        <CopyButton value={slip.id} label={t("earnings.payslipId")} />
                    </div>
                </div>
                {row(t("earnings.paidOn"), slip.paidAt ? formatDateTime(slip.paidAt, locale) : "—")}
                {row(t("earnings.paidBy"), slip.paidBy || "—")}
                {(slip.paymentProofUrl || slip.notes) && (
                    <div className="pt-2.5 border-t border-gray-100 space-y-1.5">
                        <p className="text-gray-500">{t("earnings.receiptAndNote")}</p>
                        <div className="flex gap-2.5">
                            {slip.paymentProofUrl && (
                                <button
                                    onClick={() => setProof(true)}
                                    className="w-20 h-20 shrink-0 rounded-xl overflow-hidden bg-gray-100"
                                >
                                    <img
                                        src={slip.paymentProofUrl}
                                        alt={t("earnings.transferProof")}
                                        className="size-full object-cover"
                                    />
                                </button>
                            )}
                            {slip.notes && (
                                <p className="flex-1 min-w-0 text-sm text-gray-800 whitespace-pre-wrap bg-slate-50 rounded-xl p-3">
                                    {slip.notes}
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </div>
            {slip.paymentProofUrl && (
                <ImagePreview
                    open={proof}
                    onClose={() => setProof(false)}
                    src={slip.paymentProofUrl}
                    title={t("earnings.transferProof")}
                />
            )}

            <div className="bg-white rounded-2xl px-3 py-3 space-y-1.5">
                <h3 className="text-sm font-semibold text-gray-800">{t("more.workDays")}</h3>
                <div className="grid grid-cols-7 gap-1.5 mb-1">
                    {WEEKDAYS.map((d) => (
                        <span key={d} className="text-xs font-semibold text-gray-500 text-center">
                            {t(`common.weekdays.${d}`)}
                        </span>
                    ))}
                </div>
                <div className="grid grid-cols-7 gap-1.5 items-center">
                    {period.map((day) => (
                        <div
                            key={day}
                            className={`w-9 h-9 mx-auto flex items-center justify-center rounded-lg text-sm font-medium ${worked.has(day) ? "bg-brand text-white font-semibold" : "bg-gray-100 text-gray-500"}`}
                        >
                            {+day.slice(8)}
                        </div>
                    ))}
                </div>
            </div>

            <section className="space-y-2">
                <p className="pl-3 text-lg font-semibold text-gray-800">
                    {t("earnings.dailyBreakdown")}
                </p>
                <div className="space-y-3">
                    {dates.map((date) => {
                        const commissions = slip.commissionRows.filter((c) => c.date === date);
                        const claims = slip.claimRows.filter((c) => c.date === date);
                        const all = [...commissions, ...claims];
                        const reviewed = all.every((r) => r.status !== "pending");
                        const total = all
                            .filter((r) => r.status === "approved")
                            .reduce((n, r) => n + r.amount, 0);
                        return (
                            <div key={date} className="bg-white rounded-2xl p-3 space-y-3">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <h4 className="text-base font-bold text-gray-800 shrink-0">
                                            {formatCalendarDay(date, locale, "short")}
                                        </h4>
                                        <span
                                            className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${reviewed ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}
                                        >
                                            {reviewed
                                                ? t("earnings.statusDone")
                                                : t("claims.statusPending")}
                                        </span>
                                    </div>
                                    <span className="text-base font-bold text-green-600 shrink-0">
                                        {formatMoney(total)}
                                    </span>
                                </div>
                                {commissions.length > 0 && (
                                    <div className="space-y-1.5">
                                        <p className="text-sm font-semibold text-gray-900">
                                            {t("earnings.commissionsRow")}
                                        </p>
                                        <div className="bg-slate-100 rounded-xl px-3 py-2 space-y-2">
                                            {commissions.map((c) => (
                                                <div
                                                    key={c.id}
                                                    className="flex items-center justify-between gap-2"
                                                >
                                                    <div className="min-w-0">
                                                        <p className="text-sm text-gray-700 font-medium">
                                                            {c.storeName || "—"}
                                                        </p>
                                                        <p className="text-sm font-semibold text-blue-600">
                                                            {c.cups}{" "}
                                                            {t("analytics.cups").toLowerCase()}
                                                            <span className="font-normal text-gray-600 ml-1">
                                                                × {formatMoney(c.ratePerCup)}
                                                            </span>
                                                        </p>
                                                    </div>
                                                    {amount(c.status, c.amount)}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {claims.length > 0 && (
                                    <div className="space-y-1.5">
                                        <p className="text-sm font-semibold text-gray-900">
                                            {t("earnings.claimsRow")}
                                        </p>
                                        <div className="bg-slate-100 rounded-xl px-3 py-2 space-y-2">
                                            {claims.map((c) => (
                                                <div
                                                    key={c.id}
                                                    className="flex items-center justify-between gap-2 text-sm"
                                                >
                                                    <p className="text-gray-800 font-medium min-w-0 truncate">
                                                        {c.type || "—"}
                                                    </p>
                                                    {amount(c.status, c.amount)}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </section>
        </div>
    );
}
