import type { components } from "@tea-pos/api-client";
import { formatMoney, localDate } from "@tea-pos/format";
import type { MessageKey } from "@tea-pos/i18n";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { Sheet } from "@tea-pos/ui/Sheet";
import { useNavigate } from "@tanstack/react-router";
import {
    CalendarClock,
    CalendarDays,
    Check,
    Search,
    SlidersHorizontal,
    UserCircle,
    X,
} from "lucide-react";
import { useState } from "react";

import { avatar } from "@tea-pos/shell/avatar";

import { payDate, usePayouts, usePayPeriod, useSlug } from "./pay";

type Payout = components["schemas"]["Payout"];
type Filter = "all" | "ongoing" | "paid" | "needs_review";
const FILTERS: Filter[] = ["all", "ongoing", "paid", "needs_review"];

const STATUS_STYLE: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700",
    paid: "bg-green-100 text-green-700",
    skipped: "bg-gray-200 text-gray-600",
    needs_review: "bg-orange-100 text-orange-700",
};

/** ISO week number of a `2026-10-12` date. */
export function isoWeek(date: string): number {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
    return Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7);
}

/** `Week 41` or `Week 41 · Week 43`. */
export function weeks(start: string, end: string, word: string): string {
    const a = isoWeek(start);
    const b = isoWeek(end);
    return a === b ? `${word} ${a}` : `${word} ${a} · ${word} ${b}`;
}

export const dayMonth = (date: string, locale: string) =>
    new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-GB", {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
    }).format(new Date(`${date}T00:00:00Z`));

export const shortDay = (date: string, locale: string) =>
    new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: "UTC",
    }).format(new Date(`${date}T00:00:00Z`));

/** The old backoffice's Staff Payouts: a month of payouts, ongoing first, searchable and filtered. */
export function PayoutList() {
    const t = useT();
    const locale = useLocale();
    const [month, setMonth] = useState(localDate().slice(0, 7));
    const [query, setQuery] = useState("");
    const [filterOpen, setFilterOpen] = useState(false);
    const [filter, setFilter] = useState<Filter>("all");
    const [nonSellers, setNonSellers] = useState(false);
    const { data } = usePayouts(month);
    const { data: period } = usePayPeriod();

    const q = query.trim().toLowerCase();
    const shown = (data?.payouts ?? []).filter((p) => {
        if (filter === "ongoing" && p.status !== "pending") return false;
        if (filter === "paid" && p.status === "pending") return false;
        if (filter === "needs_review" && p.pending === 0) return false;
        if (!nonSellers && p.nonSeller) return false;
        return !q || p.name.toLowerCase().includes(q);
    });
    const ongoing = shown
        .filter((p) => p.status === "pending")
        .sort((a, b) => b.pending - a.pending || b.start.localeCompare(a.start));
    const done = shown.filter((p) => p.status !== "pending");
    const activeFilters = (filter !== "all" ? 1 : 0) + (nonSellers ? 1 : 0);

    return (
        <div className="space-y-3">
            {period && (
                <div className="bg-white p-3 rounded-2xl flex items-center gap-3">
                    <div className="size-11 rounded-xl bg-brand/10 flex items-center justify-center shrink-0">
                        <CalendarClock size={24} className="text-brand" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-500">{t("pay.nextPayout")}</p>
                        <p className="text-lg font-bold text-gray-900">
                            {payDate(period.payoutDate, locale)}
                        </p>
                    </div>
                </div>
            )}
            <div className="bg-white p-4 rounded-2xl">
                <label className="block text-sm font-medium text-gray-700">
                    <CalendarDays size={16} className="inline mr-1" />
                    {t("pay.selectMonth")}
                    <input
                        type="month"
                        value={month}
                        onChange={(e) => setMonth(e.target.value || localDate().slice(0, 7))}
                        className="mt-2 w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand/90 focus:outline-none"
                    />
                </label>
            </div>
            <div className="flex gap-2">
                <div className="flex-1 flex items-center gap-2 bg-white rounded-xl px-3 py-2.5">
                    <Search size={16} className="text-gray-400 shrink-0" />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={t("pay.searchStaff")}
                        className="flex-1 text-base text-gray-800 placeholder:text-gray-400 bg-transparent outline-none"
                    />
                    {query && (
                        <button
                            onClick={() => setQuery("")}
                            className="text-gray-400"
                            aria-label={t("common.close")}
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>
                <button
                    onClick={() => setFilterOpen(true)}
                    aria-label={t("pay.filter")}
                    className="relative flex items-center justify-center w-11 bg-white rounded-xl active:bg-gray-50"
                >
                    <SlidersHorizontal
                        size={18}
                        className={activeFilters > 0 ? "text-brand" : "text-gray-500"}
                    />
                    {activeFilters > 0 && (
                        <span className="absolute -top-1 -right-1 size-4 bg-brand text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                            {activeFilters}
                        </span>
                    )}
                </button>
            </div>
            {!data ? (
                [1, 2, 3].map((i) => <div key={i} className="h-44 bg-white rounded-2xl" />)
            ) : shown.length === 0 ? (
                <p className="text-center text-gray-400 py-10">{t("pay.noPayouts")}</p>
            ) : (
                <div className="space-y-2">
                    {ongoing.map((p) => (
                        <PayoutCard key={p.id} p={p} />
                    ))}
                    {ongoing.length > 0 && done.length > 0 && (
                        <div className="flex items-center gap-3 py-1">
                            <div className="flex-1 h-px bg-gray-200" />
                            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                                {t("pay.done")}
                            </span>
                            <div className="flex-1 h-px bg-gray-200" />
                        </div>
                    )}
                    {done.map((p) => (
                        <PayoutCard key={p.id} p={p} />
                    ))}
                </div>
            )}
            <Sheet open={filterOpen} onClose={() => setFilterOpen(false)} title={t("pay.filter")}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    {t("pay.statusLabel")}
                </p>
                <div className="flex flex-col gap-1 mb-5">
                    {FILTERS.map((f) => (
                        <button
                            key={f}
                            onClick={() => {
                                setFilter(f);
                                setFilterOpen(false);
                            }}
                            className="flex items-center justify-between px-3 py-3 rounded-xl active:bg-gray-50"
                        >
                            <span
                                className={`text-[15px] font-medium ${filter === f ? "text-brand" : "text-gray-800"}`}
                            >
                                {t(`pay.filters.${f}` as MessageKey)}
                            </span>
                            {filter === f && <Check size={16} className="text-brand" />}
                        </button>
                    ))}
                </div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    {t("pay.staffLabel")}
                </p>
                <button
                    onClick={() => setNonSellers(!nonSellers)}
                    className="w-full flex items-center justify-between px-3 py-3 rounded-xl active:bg-gray-50 text-left"
                >
                    <div>
                        <p
                            className={`text-[15px] font-medium ${nonSellers ? "text-brand" : "text-gray-800"}`}
                        >
                            {t("pay.showNonSellers")}
                        </p>
                        <p className="text-xs text-gray-400">{t("pay.showNonSellersSub")}</p>
                    </div>
                    {nonSellers && <Check size={16} className="text-brand shrink-0" />}
                </button>
            </Sheet>
        </div>
    );
}

function PayoutCard({ p }: { p: Payout }) {
    const t = useT();
    const locale = useLocale();
    const navigate = useNavigate();
    const slug = useSlug();
    const needsReview = p.status === "pending" && p.pending > 0;
    const reviewed = p.approved + p.pending;
    const label = needsReview
        ? t("pay.needsReview")
        : p.status === "pending"
          ? t("pay.ongoing")
          : `${t(p.status === "skipped" ? "pay.skipped" : "pay.paid")}${p.paidAt ? ` · ${dayMonth(p.paidAt.slice(0, 10), locale)}` : ""}`;
    const tile = (name: string, value: string, tone: string, wide = false) => {
        const [bg, text] = tone.split(" ");
        return (
            <div className={`${bg} p-2 rounded-lg ${wide ? "col-span-2" : ""}`}>
                <p className="text-xs font-semibold text-gray-500">{name}</p>
                <p className={`text-lg font-bold ${text}`}>{value}</p>
            </div>
        );
    };
    return (
        <button
            onClick={() =>
                void navigate({
                    to: "/$tenant/pay/payouts/$payoutId",
                    params: { tenant: slug, payoutId: p.id },
                })
            }
            className="w-full bg-white rounded-2xl p-3 text-left active:bg-gray-50 space-y-3"
        >
            <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                    <p className="text-lg font-bold text-gray-900">
                        {weeks(p.start, p.end, t("pay.week"))}
                    </p>
                    <p className="text-sm text-gray-500">
                        {shortDay(p.start, locale)} – {shortDay(p.end, locale)}
                    </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                    <span
                        className={`text-sm font-medium px-2 py-0.5 rounded-full ${needsReview ? STATUS_STYLE.needs_review : (STATUS_STYLE[p.status] ?? STATUS_STYLE.pending)}`}
                    >
                        {label}
                    </span>
                    {reviewed > 0 && (
                        <span className="text-xs font-medium text-gray-500">
                            {t("pay.approvedOf")
                                .replace("{n}", String(p.approved))
                                .replace("{of}", String(reviewed))}
                        </span>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-2 bg-slate-100 rounded-xl p-1.5 w-full">
                {p.avatarUrl ? (
                    <img
                        src={avatar(p.avatarUrl)}
                        alt=""
                        width={28}
                        height={28}
                        referrerPolicy="no-referrer"
                        className="size-7 rounded-lg object-cover shrink-0"
                    />
                ) : (
                    <div className="size-7 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
                        <UserCircle size={18} className="text-brand" />
                    </div>
                )}
                <p className="text-base font-bold text-gray-900 truncate flex-1">{p.name}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-2 grid grid-cols-4 gap-2">
                {tile(t("pay.orders"), String(p.orders), "bg-orange-100 text-orange-600")}
                {tile(t("pay.cups"), String(p.cups), "bg-blue-100 text-blue-600")}
                {tile(
                    t("pay.commission"),
                    formatMoney(p.commissions),
                    "bg-teal-100 text-teal-600",
                    true,
                )}
                {tile(
                    t("pay.claims"),
                    formatMoney(p.claims),
                    "bg-purple-100 text-purple-600",
                    true,
                )}
                {tile(t("pay.total"), formatMoney(p.total), "bg-green-100 text-green-600", true)}
            </div>
        </button>
    );
}
