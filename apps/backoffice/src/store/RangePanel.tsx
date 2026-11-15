import type { components } from "@tea-pos/api-client";
import type { ReactNode } from "react";
import { formatCalendarDay, formatCount, formatMoney } from "@tea-pos/format";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { AreaChart } from "@tea-pos/ui/AreaChart";
import { Panel, PanelLabel } from "@tea-pos/ui/Panel";
import { Skeleton } from "@tea-pos/ui/Skeleton";

import { useRange } from "./range";
import { useSalesDays, useSalesHours } from "./sales";

const TILE = "rounded-xl bg-slate-100 p-3";

type Store = components["schemas"]["StoreLive"];

// A label and its value across the row, as a payslip's details; in a grey box as the chart's.
const fact = (label: string, value: string) => (
    <div key={label} className="flex items-center justify-between">
        <span className="text-gray-900">{label}</span>
        <span className="font-semibold text-gray-900">{value}</span>
    </div>
);

/**
 * The store cards below added up: sales, the cups chart (by hour or by day), then its figures.
 */
export function RangePanel({
    stores,
    facts = [],
    children,
}: {
    stores: Store[] | undefined;
    /** More label and value rows under the panel's own: one store's status and seller. */
    facts?: { label: string; value: string }[];
    /** Under the chart, in the same card: one store's sellers over a range. */
    children?: ReactNode;
}) {
    const t = useT();
    const locale = useLocale();
    const { from, to, single } = useRange();
    const hours = useSalesHours(single ? from : "");
    const days = useSalesDays(single ? "" : from, to);
    const points = single
        ? hours.data?.hours.map((h) => ({
              key: String(h.hour),
              label: `${String(h.hour).padStart(2, "0")}:00`,
              value: h.cups,
          }))
        : days.data?.days.map((d) => ({
              key: d.date,
              label: formatCalendarDay(d.date, locale, "dayMonth"),
              value: d.cups,
          }));
    const sum = (of: (s: Store) => number) => (stores ?? []).reduce((n, s) => n + of(s), 0);
    const cups = sum((s) => s.cups);
    const orders = sum((s) => s.orders);
    // One day's busiest hour, from the chart's own data.
    const peak = hours.data?.hours.reduce<(typeof hours.data.hours)[number] | undefined>(
        (top, h) => (h.cups > (top?.cups ?? 0) ? h : top),
        undefined,
    );
    // The stores that opened that day, for cups per store.
    const opened = sum((s) => (s.days > 0 ? 1 : 0));
    const daysSold = days.data?.days.filter((d) => d.cups > 0).length ?? 0;
    // The day with the most cups, from the chart's own data: no request of its own.
    const best = days.data?.days.reduce<(typeof days.data.days)[number] | undefined>(
        (top, d) => (d.cups > (top?.cups ?? 0) ? d : top),
        undefined,
    );
    // The quietest day that sold at all.
    const worst = days.data?.days
        .filter((d) => d.cups > 0)
        .reduce<(typeof days.data.days)[number] | undefined>(
            (low, d) => (low === undefined || d.cups < low.cups ? d : low),
            undefined,
        );
    // A store's day on average: cups over every day a store opened.
    const storeDays = sum((s) => s.days);
    // Every count with its unit and thousands mark: "6.203 cups", "3.290 orders".
    const count = (n: number, unit: string) => `${formatCount(n)} ${unit}`;
    const cupsOf = (n: number) => count(n, t("store.cupsUnit").toLowerCase());
    const day = (d: { date: string; cups: number } | undefined) =>
        d ? `${formatCalendarDay(d.date, locale, "dayMonth")} · ${cupsOf(d.cups)}` : "–";
    return (
        <Panel>
            <div className="px-1">
                <p className="text-xs font-semibold text-gray-900">{t("store.salesShort")}</p>
                {stores ? (
                    <p className="text-[22px] leading-tight font-bold tracking-tight text-green-600">
                        {formatMoney(sum((s) => s.sales))}
                    </p>
                ) : (
                    <Skeleton className="h-7 w-40 rounded" />
                )}
            </div>
            {points &&
                (points.length > 0 ? (
                    <div className="overflow-hidden rounded-xl bg-slate-100">
                        <div className="px-3 pt-3">
                            <PanelLabel>
                                {t(single ? "store.cupsByHour" : "store.totalCups")}
                            </PanelLabel>
                        </div>
                        <AreaChart points={points} unit={t("store.cupsUnit")} height={96} flush />
                    </div>
                ) : (
                    <p className={`${TILE} text-sm text-gray-900`}>{t("store.noSales")}</p>
                ))}
            {/* Under the chart, its figures as label and value rows in a grey box like the chart's. */}
            {stores && (
                <div className="space-y-2 rounded-xl bg-slate-100 p-3 text-sm">
                    {fact(t("store.cupsTotal"), cupsOf(cups))}
                    {fact(t("store.ordersTotal"), count(orders, t("store.orders").toLowerCase()))}
                    {single ? (
                        <>
                            {fact(
                                t("store.busiestHour"),
                                peak && peak.cups > 0
                                    ? `${String(peak.hour).padStart(2, "0")}:00`
                                    : "–",
                            )}
                            {fact(t("store.expenses"), formatMoney(sum((s) => s.expenses)))}
                            {stores.length > 1 &&
                                fact(t("store.cupsPerStore"), opened ? cupsOf(cups / opened) : "–")}
                        </>
                    ) : (
                        <>
                            {fact(t("store.cupsPerDay"), daysSold ? cupsOf(cups / daysSold) : "–")}
                            {fact(t("store.bestDay"), day(best))}
                            {fact(t("store.slowestDay"), day(worst))}
                            {fact(
                                t("store.cupsPerStoreDay"),
                                storeDays ? cupsOf(cups / storeDays) : "–",
                            )}
                            {fact(t("store.expenses"), formatMoney(sum((s) => s.expenses)))}
                        </>
                    )}
                    {facts.map((f) => fact(f.label, f.value))}
                </div>
            )}
            {children}
        </Panel>
    );
}
