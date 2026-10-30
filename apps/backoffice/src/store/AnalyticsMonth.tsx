import type { components } from "@tea-pos/api-client";
import { formatDate, formatDay, formatMoney, localDate } from "@tea-pos/format";
import { useLocale, useT } from "@tea-pos/i18n/react";

import { useSlug } from "@tea-pos/shell/tenant";
import { AreaChart } from "@tea-pos/ui/AreaChart";
import { Sheet } from "@tea-pos/ui/Sheet";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, History, Info, MoreVertical, Receipt, Users, X } from "lucide-react";
import { useState } from "react";

import { RangeBar, useRange } from "./range";
import { ALL, useDays, useSalesDays, useStoreId } from "./sales";
import { Skeleton } from "@tea-pos/ui/Skeleton";
import { ICON } from "@tea-pos/ui/icon";
import { EmptyState } from "@tea-pos/ui/EmptyState";
import { Sellers } from "./Sellers";
import { Badge } from "@tea-pos/ui/Badge";

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

            <Sheet
                open={!!active}
                onClose={() => setActive(null)}
                title={
                    active
                        ? `${formatDay(active.date, locale)}${severalStores ? ` · ${active.storeName}` : ""}`
                        : ""
                }
            >
                {active &&
                    [
                        {
                            icon: Info,
                            label: t("analytics.details"),
                            to: "/$tenant/store/$storeId/analytics/days/$dayId",
                        },
                        {
                            icon: History,
                            label: t("analytics.activity"),
                            to: "/$tenant/store/$storeId/analytics/days/$dayId/activity",
                        },
                        {
                            icon: Users,
                            label: t("analytics.sessions"),
                            to: "/$tenant/store/$storeId/analytics/days/$dayId/sessions",
                        },
                    ].map((item, i, all) => (
                        <Link
                            key={item.label}
                            to={item.to}
                            params={{ tenant: slug, storeId, dayId: active.id }}
                            onClick={() => setActive(null)}
                            className={`w-full flex items-center gap-3 py-5 ${i < all.length - 1 ? "border-b" : ""}`}
                        >
                            <item.icon size={ICON} strokeWidth={2} className="text-gray-900" />
                            <span className="text-lg text-gray-900">{item.label}</span>
                        </Link>
                    ))}
            </Sheet>
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

function DayCard({ day, storeName, onMenu }: { day: Day; storeName: boolean; onMenu: () => void }) {
    const t = useT();
    const locale = useLocale();
    const cell = (label: string, value: string, color: string) => (
        <div>
            <p className="text-xs">{label}</p>
            <p className={`text-lg font-extrabold ${color}`}>{value}</p>
        </div>
    );
    return (
        <div id={`day-${day.id}`} className="bg-white rounded-2xl overflow-hidden">
            <div className="p-3 space-y-3">
                <div className="flex justify-between items-start">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h3 className="text-xl font-bold text-gray-800">
                                {formatDay(day.date, locale)}
                            </h3>
                            <Badge>
                                {t(
                                    day.closedAt
                                        ? "analytics.statusClosed"
                                        : "analytics.statusOpen",
                                )}
                            </Badge>
                        </div>
                        {storeName && (
                            <p className="text-sm text-gray-500 truncate">{day.storeName}</p>
                        )}
                    </div>
                    <button
                        onClick={onMenu}
                        aria-label={t("store.dayMenu")}
                        className="size-8 shrink-0 flex items-center justify-center text-gray-500 active:opacity-60 rounded-lg"
                    >
                        <MoreVertical size={ICON} strokeWidth={2.5} />
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-2 rounded-2xl p-2 bg-slate-100 text-gray-800">
                    {cell(
                        t("analytics.openingBalance"),
                        formatMoney(day.openingBalance),
                        "text-blue-600",
                    )}
                    {cell(t("analytics.totalSales"), formatMoney(day.sales), "text-green-600")}
                    {cell(
                        t("analytics.openingPlusSales"),
                        formatMoney(day.openingBalance + day.sales),
                        "text-purple-600",
                    )}
                    <div className="flex gap-4">
                        {cell(t("analytics.orders"), String(day.orders), "text-blue-600")}
                        {cell(t("analytics.cups"), String(day.cups), "text-orange-600")}
                    </div>
                    <hr className="col-span-2 border-gray-300" />
                    {cell(
                        t("analytics.expectedCash"),
                        formatMoney(day.expectedCash),
                        "text-purple-600",
                    )}
                    {cell(
                        t("analytics.actualCash"),
                        day.actualCash === null
                            ? t("analytics.notCounted")
                            : formatMoney(day.actualCash),
                        "text-orange-600",
                    )}
                </div>

                <Sellers sellers={day.sellers} />

                {day.expenseItems.length > 0 && (
                    <div>
                        <h4 className="text-gray-800 text-sm font-semibold mb-1">
                            {t("analytics.expensesOfDay")}
                        </h4>
                        <div className="bg-red-100 p-2 rounded-xl">
                            {day.expenseItems.map((e) => (
                                <div
                                    key={e.id}
                                    className="flex justify-between text-sm font-semibold text-red-800"
                                >
                                    <span>{e.type}</span>
                                    <span>-{formatMoney(e.amount)}</span>
                                </div>
                            ))}
                            <div className="border-t border-red-300 mt-1 pt-1 flex justify-between font-extrabold text-red-800">
                                <span>{t("analytics.total")}</span>
                                <span>-{formatMoney(day.expenses)}</span>
                            </div>
                        </div>
                    </div>
                )}

                {day.variance !== null && (
                    <div>
                        <h4 className="text-gray-800 text-sm font-semibold mb-1">
                            {t("analytics.variance")}
                        </h4>
                        <p
                            className={`text-sm px-3 py-2 rounded-xl font-bold ${
                                day.variance >= 0
                                    ? "bg-green-100 text-green-800"
                                    : "bg-red-100 text-red-800"
                            }`}
                        >
                            {day.variance >= 0 ? "+" : ""}
                            {formatMoney(day.variance)}
                        </p>
                    </div>
                )}

                {day.notes && (
                    <div>
                        <h4 className="text-gray-800 text-sm font-semibold mb-1">
                            {t("analytics.notes")}
                        </h4>
                        <p className="text-sm text-gray-700 bg-slate-100 p-2 rounded-xl">
                            {day.notes}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
