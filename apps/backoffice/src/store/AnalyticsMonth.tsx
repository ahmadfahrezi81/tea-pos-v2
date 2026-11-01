import type { components } from "@tea-pos/api-client";
import { formatDate, formatDay, formatMoney, localDate } from "@tea-pos/format";
import { useLocale, useT } from "@tea-pos/i18n/react";

import { useSlug } from "@tea-pos/shell/tenant";
import { AreaChart } from "@tea-pos/ui/AreaChart";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Receipt, X } from "lucide-react";
import { useState } from "react";

import { RangeBar, useRange } from "./range";
import { ALL, useDays, useSalesDays, useStoreId } from "./sales";
import { Skeleton } from "@tea-pos/ui/Skeleton";
import { ICON } from "@tea-pos/ui/icon";
import { EmptyState } from "@tea-pos/ui/EmptyState";
import { DayCard, DayMenu } from "@tea-pos/shell/DayCard";

type Day = components["schemas"]["Day"];

/**
 * Day by day, the old seller app's Analytics, for the picked stores and range: the totals, cups per day, and
 * each store's day with its cash, who worked and expenses; a day's menu opens its detail,
 * activity and sessions.
 */
export function AnalyticsMonth() {
    const t = useT();
    const locale = useLocale();
    const slug = useSlug();
    const storeId = useStoreId();
    const severalStores = storeId === ALL;
    const { from, to, label } = useRange();
    const days = useDays(from, to);
    const perDay = useSalesDays(from, to);
    const [warningDismissed, setWarningDismissed] = useState(false);
    const [active, setActive] = useState<Day | null>(null);
    const list = days.data?.days;
    const today = localDate();
    const unclosed = (list ?? []).filter((d) => !d.closedAt && d.date !== today);
    const total = (pick: (d: Day) => number) => (list ?? []).reduce((sum, d) => sum + pick(d), 0);

    return (
        <div className="space-y-4">
            {unclosed.length > 0 && !warningDismissed && (
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
                            onClick={() => setWarningDismissed(true)}
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
                    <Total
                        label={t("analytics.orders")}
                        value={list && String(total((d) => d.orders))}
                        color="text-blue-600"
                    />
                    <Total
                        label={t("analytics.cups")}
                        value={list && String(total((d) => d.cups))}
                        color="text-orange-600"
                    />
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

            <RangeBar />

            {perDay.data && perDay.data.days.length > 0 && (
                <Link
                    to="/$tenant/store/$storeId/analytics/charts"
                    params={{ tenant: slug, storeId }}
                    search={{ from, to }}
                    className="block bg-white rounded-2xl p-2 pb-1"
                >
                    <AreaChart
                        points={perDay.data.days.map((d) => ({
                            key: d.date,
                            label: formatDate(d.date, locale),
                            value: d.cups,
                        }))}
                        unit={t("orders.cups")}
                        height={130}
                    />
                </Link>
            )}

            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-800">{label}</h3>
                <span className="text-sm text-gray-500">
                    {list?.length ?? 0} {t("store.days")}
                </span>
            </div>

            <div className="space-y-3">
                {!list ? (
                    Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} delay={i * 80} className="h-48 rounded-2xl" />
                    ))
                ) : list.length === 0 ? (
                    <EmptyState title={t("analytics.noSummary")} />
                ) : (
                    list.map((day) => (
                        <DayCard
                            key={day.id}
                            day={day}
                            storeName={severalStores}
                            onMenu={() => setActive(day)}
                        />
                    ))
                )}
            </div>

            <DayMenu
                day={active}
                onClose={() => setActive(null)}
                title={
                    active
                        ? `${formatDay(active.date, locale)}${severalStores ? ` · ${active.storeName}` : ""}`
                        : ""
                }
                base={active ? `/${slug}/store/${storeId}/analytics/days/${active.id}` : ""}
            />
        </div>
    );
}

function Total({
    label,
    value,
    color,
}: {
    label: string;
    value: string | undefined;
    color: string;
}) {
    return (
        <div className="text-center">
            {value === undefined ? (
                <div className="mx-auto h-7 w-8 rounded bg-gray-100" />
            ) : (
                <p className={`text-xl font-bold ${color}`}>{value}</p>
            )}
            <p className="text-sm text-gray-600">{label}</p>
        </div>
    );
}
