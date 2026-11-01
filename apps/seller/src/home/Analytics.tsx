import type { components } from "@tea-pos/api-client";
import { addDays, formatDate, formatDay, formatMoney, localDate } from "@tea-pos/format";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { DayCard, DayMenu } from "@tea-pos/shell/DayCard";
import { useSlug } from "@tea-pos/shell/tenant";
import { AreaChart } from "@tea-pos/ui/AreaChart";
import { EmptyState } from "@tea-pos/ui/EmptyState";
import { ICON } from "@tea-pos/ui/icon";
import { Skeleton } from "@tea-pos/ui/Skeleton";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, CalendarDays, Receipt, X } from "lucide-react";
import { useState } from "react";

import { useMonthDays, useMonthSales } from "./home";

type Day = components["schemas"]["Day"];

const lastOfMonth = (month: string) => {
    const y = Number(month.slice(0, 4));
    const m = Number(month.slice(5, 7));
    return addDays(
        `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`,
        -1,
    );
};

/** The store's month, day by day. A day left open from before can be closed from here. */
export function Analytics() {
    const t = useT();
    const locale = useLocale();
    const slug = useSlug();
    const today = localDate();
    const [month, setMonth] = useState(today.slice(0, 7));
    const from = `${month}-01`;
    const to = lastOfMonth(month);
    const { data } = useMonthDays(from, to);
    const { data: sales } = useMonthSales(from, to);
    const [dismissed, setDismissed] = useState(false);
    const [active, setActive] = useState<Day | null>(null);
    const list = data?.days;
    const unclosed = (list ?? []).filter((d) => !d.closedAt && d.date !== today);
    const total = (pick: (d: Day) => number) => (list ?? []).reduce((n, d) => n + pick(d), 0);
    const figure = (value: number | undefined, label: string, color: string) => (
        <div className="text-center">
            {value === undefined ? (
                <Skeleton className="mx-auto h-7 w-8 rounded" />
            ) : (
                <p className={`text-xl font-bold ${color}`}>{value}</p>
            )}
            <p className="text-sm text-gray-600">{label}</p>
        </div>
    );
    return (
        <div className="space-y-4">
            {unclosed.length > 0 && !dismissed && (
                <div className="bg-red-100 p-3.5 rounded-xl">
                    <div className="flex items-start justify-between mb-2">
                        <button
                            className="flex items-center gap-2 text-left active:opacity-60"
                            onClick={() =>
                                document
                                    .getElementById(`day-${unclosed[unclosed.length - 1]?.id}`)
                                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                            }
                        >
                            <AlertTriangle size={ICON} className="text-red-600" />
                            <h3 className="font-semibold text-red-800">
                                {unclosed.length} {t("analytics.unclosedWarning")}
                            </h3>
                        </button>
                        <button
                            onClick={() => setDismissed(true)}
                            className="p-1 -mt-1 -mr-2 rounded-full text-red-600 active:opacity-60"
                        >
                            <X size={ICON} />
                        </button>
                    </div>
                    <p className="text-sm text-red-800">{t("analytics.unclosedSub")}</p>
                </div>
            )}

            <div className="bg-white p-4 rounded-2xl">
                <div className="flex items-center gap-2 mb-3">
                    <Receipt size={ICON} className="text-gray-600" />
                    <h3 className="font-semibold text-gray-800">{t("store.totals")}</h3>
                </div>
                <div className="grid grid-cols-4 gap-2">
                    {figure(list && total((d) => d.orders), t("analytics.orders"), "text-blue-600")}
                    {figure(list && total((d) => d.cups), t("analytics.cups"), "text-orange-600")}
                    <div className="text-center col-span-2 border-l-2 border-gray-300">
                        <p className="text-sm text-gray-600">{t("analytics.totalSales")}</p>
                        {list ? (
                            <p className="text-xl font-bold text-green-600">
                                {formatMoney(total((d) => d.sales))}
                            </p>
                        ) : (
                            <Skeleton className="mx-auto mt-1 h-7 w-24 rounded" />
                        )}
                    </div>
                </div>
            </div>

            <div className="bg-white p-4 rounded-2xl">
                <label className="block text-sm font-medium text-gray-700">
                    <CalendarDays size={16} className="inline mr-1" />
                    {t("analytics.selectMonth")}
                    <input
                        type="month"
                        value={month}
                        onChange={(e) => setMonth(e.target.value || today.slice(0, 7))}
                        className="mt-2 w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand/90 focus:outline-none"
                    />
                </label>
            </div>

            {sales && sales.days.length > 0 && (
                <div className="bg-white rounded-2xl p-2 pb-1">
                    <AreaChart
                        points={sales.days.map((d) => ({
                            key: d.date,
                            label: formatDate(d.date, locale),
                            value: d.cups,
                        }))}
                        unit={t("orders.cups")}
                        height={130}
                    />
                </div>
            )}

            <div className="space-y-3">
                {!list ? (
                    Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} delay={i * 80} className="h-48 rounded-2xl" />
                    ))
                ) : list.length === 0 ? (
                    <EmptyState title={t("analytics.noSummary")} />
                ) : (
                    list.map((day) => (
                        <DayCard key={day.id} day={day} onMenu={() => setActive(day)}>
                            {!day.closedAt && (
                                <div className="border-t border-gray-100 p-3">
                                    <Link
                                        to="/$tenant/manage/close"
                                        params={{ tenant: slug }}
                                        search={{ day: day.id }}
                                        className="block w-full text-center bg-red-500 text-white py-4 px-4 rounded-xl text-sm font-semibold active:scale-95"
                                    >
                                        {t("analytics.closeDay")}
                                    </Link>
                                </div>
                            )}
                        </DayCard>
                    ))
                )}
            </div>

            <DayMenu
                day={active}
                onClose={() => setActive(null)}
                title={active ? formatDay(active.date, locale) : ""}
                base={active ? `/${slug}/analytics/days/${active.id}` : ""}
            />
        </div>
    );
}
