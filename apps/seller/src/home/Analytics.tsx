import { LoadFailed } from "@tea-pos/shell/LoadFailed";
import type { components } from "@tea-pos/api-client";
import { formatDate, formatDay, formatMoney, localDate } from "@tea-pos/format";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { DayCard, DayMenu } from "@tea-pos/shell/DayCard";
import { useSlug } from "@tea-pos/shell/tenant";
import { AreaChart } from "@tea-pos/ui/AreaChart";
import { EmptyState } from "@tea-pos/ui/EmptyState";
import { ICON } from "@tea-pos/ui/icon";
import { Skeleton } from "@tea-pos/ui/Skeleton";
import { Tile } from "@tea-pos/ui/Tile";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, X } from "lucide-react";
import { useState } from "react";

import { useMonthDays, useMonthSales } from "./home";
import { MonthBar, useSellerMonth } from "./period";

type Day = components["schemas"]["Day"];

/** The store's month, day by day (this one or the two before). A day left open from before can be closed from here. */
export function Analytics() {
    const t = useT();
    const locale = useLocale();
    const slug = useSlug();
    const today = localDate();
    const [{ from, to, month }] = useSellerMonth();
    const { data, error } = useMonthDays(from, to);
    const { data: sales } = useMonthSales(from, to);
    const [dismissed, setDismissed] = useState(false);
    const [active, setActive] = useState<Day | null>(null);
    const list = data?.days;
    const unclosed = (list ?? []).filter((d) => !d.closedAt && d.date !== today);
    const total = (pick: (d: Day) => number) => (list ?? []).reduce((n, d) => n + pick(d), 0);
    return (
        <div className="space-y-3">
            <MonthBar />
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

            {/* The totals and the cups by day: one card. */}
            <div className="bg-white rounded-2xl">
                <div className="grid grid-cols-4 gap-1.5 p-3">
                    <Tile
                        label={t("analytics.orders")}
                        value={list && String(total((d) => d.orders))}
                        className="bg-blue-100"
                        color="text-blue-900"
                    />
                    <Tile
                        label={t("analytics.cups")}
                        value={list && String(total((d) => d.cups))}
                        className="bg-orange-100"
                        color="text-orange-900"
                    />
                    <Tile
                        label={t("analytics.totalSales")}
                        value={list && formatMoney(total((d) => d.sales))}
                        className="col-span-2 bg-green-100"
                        color="text-green-900"
                    />
                </div>
                {sales && sales.days.length > 0 && (
                    <div className="block px-2 pb-1">
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
            </div>

            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-800">
                    {new Intl.DateTimeFormat(locale, {
                        month: "long",
                        year: "numeric",
                        timeZone: "UTC",
                    }).format(new Date(`${month}-01T00:00:00Z`))}
                </h3>
                <span className="text-sm text-gray-500">
                    {list?.length ?? 0} {t("store.days")}
                </span>
            </div>

            <div className="space-y-3">
                {error && !list ? (
                    <LoadFailed error={error} />
                ) : !list ? (
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
