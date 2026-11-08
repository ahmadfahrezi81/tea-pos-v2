import type { components } from "@tea-pos/api-client";
import type { ReactNode } from "react";
import { formatCalendarDay, formatMoney } from "@tea-pos/format";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { AreaChart } from "@tea-pos/ui/AreaChart";
import { Panel, PanelLabel } from "@tea-pos/ui/Panel";
import { Skeleton } from "@tea-pos/ui/Skeleton";

import { useRange } from "./range";
import { useSalesDays, useSalesHours } from "./sales";

const TILE = "rounded-xl bg-slate-100 p-3";

type Store = components["schemas"]["StoreLive"];

// A label and its value across the row, as a payslip's details.
const fact = (label: string, value: string) => (
    <div key={label} className="flex items-center justify-between">
        <span className="text-gray-900">{label}</span>
        <span className="font-medium text-gray-800">{value}</span>
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
    const daysSold = days.data?.days.filter((d) => d.cups > 0).length ?? 0;
    // The day with the most cups, from the chart's own data: no request of its own.
    const best = days.data?.days.reduce<(typeof days.data.days)[number] | undefined>(
        (top, d) => (d.cups > (top?.cups ?? 0) ? d : top),
        undefined,
    );
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
            {/* Under the chart, as label and value rows: one day only its cups, several days also cups a day and the best day. */}
            {stores && (
                <div className="space-y-2 px-1 text-sm">
                    {fact(t("store.cupsTotal"), String(cups))}
                    {!single && (
                        <>
                            {fact(
                                t("store.cupsPerDay"),
                                daysSold ? String(Math.round(cups / daysSold)) : "–",
                            )}
                            {fact(
                                t("store.bestDay"),
                                best
                                    ? `${formatCalendarDay(best.date, locale, "dayMonth")} · ${best.cups}`
                                    : "–",
                            )}
                        </>
                    )}
                    {facts.map((f) => fact(f.label, f.value))}
                </div>
            )}
            {children}
        </Panel>
    );
}
