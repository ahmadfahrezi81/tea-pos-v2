import type { components } from "@tea-pos/api-client";
import { formatDate, formatMoney, formatMonth, localDate } from "@tea-pos/format";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { AreaChart } from "@tea-pos/ui/AreaChart";
import { Link } from "@tanstack/react-router";
import { BarChart3, ChevronRight, CircleAlert, ReceiptText } from "lucide-react";
import type { ReactNode } from "react";
import { useTenant } from "@tea-pos/shell/tenant";

import { useSalesDays } from "./sales";

type Day = components["schemas"]["SalesDay"];

/** `2026-09-24` for `2026-10-24`: the same day last month, or its last day when shorter. */
function sameDayLastMonth(date: string): string {
    const [y = 0, m = 1, d = 1] = date.split("-").map(Number);
    const last = new Date(Date.UTC(y, m - 1, 0)).getUTCDate();
    const prev = new Date(Date.UTC(y, m - 2, Math.min(d, last)));
    return prev.toISOString().slice(0, 10);
}

const sum = (days: Day[] | undefined, pick: (d: Day) => number) =>
    (days ?? []).reduce((total, d) => total + pick(d), 0);

/**
 * The Store tab's first screen: this month at a glance for the picked stores (sales, cups,
 * orders, each against the same days last month) and cups per day; the deeper screens are
 * one tap in. A day counts once it is closed, as in the old app.
 */
export function StoreOverview() {
    const t = useT();
    const locale = useLocale();
    const today = localDate();
    const monthStart = `${today.slice(0, 8)}01`;
    const lastEnd = sameDayLastMonth(today);
    const now = useSalesDays(monthStart, today);
    const before = useSalesDays(`${lastEnd.slice(0, 8)}01`, lastEnd);
    const days = now.data?.days;
    const slug = useTenant()?.tenant.slug ?? "";

    const notClosed = (days ?? []).filter((d) => d.notClosed > 0 && d.date !== today).length;
    const todayOpen = days?.some((d) => d.date === today && d.notClosed > 0);
    const figures = [
        { label: t("analytics.totalSales"), pick: (d: Day) => d.sales, show: formatMoney },
        { label: t("analytics.cups"), pick: (d: Day) => d.cups, show: String },
        { label: t("analytics.orders"), pick: (d: Day) => d.orders, show: String },
    ];

    return (
        <div className="flex flex-col gap-3">
            <div className="rounded-2xl bg-white p-4">
                <p className="text-sm text-gray-500">
                    {t("store.thisMonth")} · {formatMonth(today, locale)}
                </p>
                {/* Sales on its own row: a month of rupiah does not fit a third of a phone. */}
                <div className="mt-3 grid grid-cols-2 gap-3">
                    {figures.map((f, i) => (
                        <div key={f.label} className={i === 0 ? "col-span-2" : undefined}>
                            <Figure
                                label={f.label}
                                value={days ? f.show(sum(days, f.pick)) : null}
                                change={change(
                                    sum(days, f.pick),
                                    before.data && sum(before.data.days, f.pick),
                                )}
                                large={i === 0}
                            />
                        </div>
                    ))}
                </div>
                <p className="mt-2 text-xs text-gray-400">{t("store.vsLastMonth")}</p>
            </div>

            {notClosed > 0 && (
                <div className="flex items-center gap-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">
                    <CircleAlert size={18} className="shrink-0" />
                    {t("store.daysNotClosed").replace("{n}", String(notClosed))}
                </div>
            )}

            <div className="rounded-2xl bg-white p-2 pb-1">
                <p className="px-2 pt-2 text-sm font-semibold text-gray-900">
                    {t("store.cupsPerDay")}
                </p>
                {days && days.length === 0 ? (
                    <p className="p-4 text-sm text-gray-500">{t("store.noSales")}</p>
                ) : (
                    <AreaChart
                        points={(days ?? []).map((d) => ({
                            key: d.date,
                            label: formatDate(d.date, locale),
                            value: d.cups,
                        }))}
                        unit={t("orders.cups")}
                    />
                )}
                {todayOpen && (
                    <p className="px-2 pb-2 text-xs text-gray-400">{t("store.todayNotClosed")}</p>
                )}
            </div>

            <ul className="rounded-2xl bg-white divide-y divide-gray-100">
                <MenuRow
                    to="/$tenant/store/analytics"
                    slug={slug}
                    icon={<BarChart3 size={20} />}
                    label={t("store.analyticsRow")}
                    sub={t("store.analyticsRowSub")}
                />
                <MenuRow
                    to="/$tenant/store/orders"
                    slug={slug}
                    icon={<ReceiptText size={20} />}
                    label={t("store.ordersRow")}
                    sub={t("store.ordersRowSub")}
                />
            </ul>
        </div>
    );
}

function MenuRow({
    to,
    slug,
    icon,
    label,
    sub,
}: {
    to: "/$tenant/store/analytics" | "/$tenant/store/orders";
    slug: string;
    icon: ReactNode;
    label: string;
    sub: string;
}) {
    return (
        <li>
            <Link to={to} params={{ tenant: slug }} className="flex items-center gap-3 p-4">
                <span className="text-gray-500">{icon}</span>
                <span className="flex-1 min-w-0">
                    <span className="block font-semibold text-gray-900">{label}</span>
                    <span className="block text-xs text-gray-500 truncate">{sub}</span>
                </span>
                <ChevronRight size={18} className="text-gray-300" />
            </Link>
        </li>
    );
}

/** `+12%` against last month's same days; nothing when there is nothing to compare with. */
function change(now: number, before: number | undefined): number | null {
    if (before === undefined || before === 0) return null;
    return Math.round(((now - before) / before) * 100);
}

function Figure({
    label,
    value,
    change,
    large,
}: {
    label: string;
    value: string | null;
    change: number | null;
    large?: boolean;
}) {
    return (
        <div className="min-w-0">
            <p className="text-xs text-gray-500 truncate">{label}</p>
            <div className="mt-0.5 flex items-baseline gap-2">
                {value === null ? (
                    <div className={`${large ? "h-8 w-40" : "h-6 w-16"} rounded bg-gray-100`} />
                ) : (
                    <p
                        className={`${large ? "text-2xl" : "text-lg"} font-bold text-gray-900 truncate`}
                    >
                        {value}
                    </p>
                )}
                {change !== null && (
                    <span
                        className={`text-xs font-semibold ${change < 0 ? "text-red-600" : "text-green-600"}`}
                    >
                        {change > 0 ? "+" : ""}
                        {change}%
                    </span>
                )}
            </div>
        </div>
    );
}
