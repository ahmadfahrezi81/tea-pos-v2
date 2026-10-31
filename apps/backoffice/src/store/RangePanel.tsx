import type { components } from "@tea-pos/api-client";
import { formatCalendarDay, formatMoney } from "@tea-pos/format";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { AreaChart } from "@tea-pos/ui/AreaChart";
import { Panel, PanelLabel } from "@tea-pos/ui/Panel";
import { Skeleton } from "@tea-pos/ui/Skeleton";
import { Tile } from "@tea-pos/ui/Tile";

import { useRange } from "./range";
import { dayCash, plain, useSalesDays, useSalesHours, useTeaWaste } from "./sales";

const TILE = "rounded-xl bg-slate-100 p-3";

type Store = components["schemas"]["StoreLive"];

/**
 * The store cards below added up. Sales, then one day: cups, cash and tea waste, cups by hour;
 * several days: cups, cups a day and tea waste a day, cups by day.
 */
export function RangePanel({ stores }: { stores: Store[] | undefined }) {
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
    const anyOpen = isToday && stores?.some((s) => s.open);
    const value = (text: string) => (stores ? text : "–");
    const cups = sum((s) => s.cups);
    const daysSold = days.data?.days.filter((d) => d.cups > 0).length ?? 0;
    // Only days whose tea was measured at closing, so today has none until it closes.
    const measured = useTeaWaste(from, to).data?.days ?? [];
    const litres = measured.length
        ? `${(measured.reduce((n, d) => n + d.litres, 0) / measured.length).toLocaleString(locale, { maximumFractionDigits: 1 })} L`
        : "–";
    return (
        <Panel>
            <div className="px-1">
                <p className="text-sm font-medium text-gray-900">{t("store.salesShort")}</p>
                {stores ? (
                    <p className="text-lg font-bold text-gray-900">
                        {formatMoney(sum((s) => s.sales))}
                    </p>
                ) : (
                    <Skeleton className="h-7 w-36 rounded" />
                )}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
                <Tile
                    label={t("store.cups")}
                    value={value(String(cups))}
                    className="bg-orange-100"
                />
                {single ? (
                    <Tile
                        label={t(anyOpen ? "store.expected" : "store.total")}
                        value={value(plain(sum((s) => dayCash(s, isToday && s.open))))}
                        className="bg-green-100"
                    />
                ) : (
                    <Tile
                        label={t("store.avgPerDay")}
                        value={daysSold ? String(Math.round(cups / daysSold)) : "–"}
                        className="bg-blue-100"
                    />
                )}
                <Tile label={t("store.teaWaste")} value={litres} className="bg-teal-100" />
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
        </Panel>
    );
}
