import type { components } from "@tea-pos/api-client";
import type { ReactNode } from "react";
import { formatCalendarDay, formatMoney } from "@tea-pos/format";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { AreaChart } from "@tea-pos/ui/AreaChart";
import { Panel, PanelLabel } from "@tea-pos/ui/Panel";
import { Skeleton } from "@tea-pos/ui/Skeleton";
import { Tile } from "@tea-pos/ui/Tile";

import { useRange } from "./range";
import { plain, useSalesDays, useSalesHours } from "./sales";

const TILE = "rounded-xl bg-slate-100 p-3";

type Store = components["schemas"]["StoreLive"];

/**
 * The store cards below added up. Sales, then one day: cups, expenses and stores open, cups by hour;
 * several days: cups, cups a day and the best day, cups by day.
 */
export function RangePanel({
    stores,
    children,
}: {
    stores: Store[] | undefined;
    /** Under the chart, in the same card: one store's sellers over a range. */
    children?: ReactNode;
}) {
    const t = useT();
    const locale = useLocale();
    const { from, to, single, isToday } = useRange();
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
    const value = (text: string) => (stores ? text : undefined);
    const cups = sum((s) => s.cups);
    const daysSold = days.data?.days.filter((d) => d.cups > 0).length ?? 0;
    // The day with the most cups, from the chart's own data: no request of its own.
    const best = days.data?.days.reduce<(typeof days.data.days)[number] | undefined>(
        (top, d) => (d.cups > (top?.cups ?? 0) ? d : top),
        undefined,
    );
    // Today: how many are selling now; a past day: how many opened at all.
    const total = stores?.length ?? 0;
    const opened = isToday ? sum((s) => (s.open ? 1 : 0)) : sum((s) => (s.days > 0 ? 1 : 0));
    return (
        <Panel>
            <div className="px-1">
                <p className="text-sm font-medium text-gray-900">{t("store.salesShort")}</p>
                {stores ? (
                    <p className="text-[22px] leading-tight font-bold tracking-tight text-green-600">
                        {formatMoney(sum((s) => s.sales))}
                    </p>
                ) : (
                    <Skeleton className="h-7 w-40 rounded" />
                )}
            </div>
            {/* A range's best day reads long ("7 Nov · 312"): 2/5 of the row, the other two 1.5/5. */}
            <div className={`grid gap-1.5 ${single ? "grid-cols-3" : "grid-cols-10"}`}>
                <Tile
                    label={t("store.cups")}
                    value={value(String(cups))}
                    className={`bg-orange-100 ${single ? "" : "col-span-3"}`}
                />
                {single ? (
                    <>
                        <Tile
                            label={t("store.expenses")}
                            value={value(plain(sum((s) => s.expenses)))}
                            className="bg-red-100"
                        />
                        <Tile
                            label={t(isToday ? "store.openNow" : "store.opened")}
                            value={value(`${opened}/${total}`)}
                            className="bg-slate-100"
                        />
                    </>
                ) : (
                    <>
                        <Tile
                            label={t("store.cupsPerDay")}
                            value={daysSold ? String(Math.round(cups / daysSold)) : "–"}
                            className="col-span-3 bg-blue-100"
                        />
                        <Tile
                            label={t("store.bestDay")}
                            value={
                                best
                                    ? `${formatCalendarDay(best.date, locale, "dayMonth")} · ${best.cups}`
                                    : "–"
                            }
                            className="col-span-4 bg-green-100"
                        />
                    </>
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
            {children}
        </Panel>
    );
}
