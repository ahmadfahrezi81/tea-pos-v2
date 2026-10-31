import type { components } from "@tea-pos/api-client";
import { formatCalendarDay, formatMoney } from "@tea-pos/format";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { AreaChart } from "@tea-pos/ui/AreaChart";
import { Panel, PanelLabel } from "@tea-pos/ui/Panel";
import { Skeleton } from "@tea-pos/ui/Skeleton";
import { Tile } from "@tea-pos/ui/Tile";

import { useRange } from "./range";
import { dayCash, plain, useSalesDays, useSalesHours } from "./sales";

const TILE = "rounded-xl bg-slate-100 p-3";

type Store = components["schemas"]["StoreLive"];

/**
 * The store cards below added up: sales, cups, expenses, then cash (one day) or how far it was off
 * (several), and cups by hour (one day) or by day.
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
    const cashOff = sum((s) => s.cashDiff);
    const value = (text: string) => (stores ? text : "–");
    return (
        <Panel>
            {stores ? (
                <p className="px-1 text-3xl font-bold text-gray-900">
                    {formatMoney(sum((s) => s.sales))}
                </p>
            ) : (
                <Skeleton className="h-9 w-44 rounded" />
            )}
            <div className="grid grid-cols-3 gap-1.5">
                <Tile
                    label={t("store.cups")}
                    value={value(String(sum((s) => s.cups)))}
                    className="bg-orange-100"
                />
                <Tile
                    label={t("store.expenses")}
                    value={value(plain(sum((s) => s.expenses)))}
                    className="bg-purple-100"
                />
                {single ? (
                    <Tile
                        label={t(anyOpen ? "store.expected" : "store.total")}
                        value={value(plain(sum((s) => dayCash(s, isToday && s.open))))}
                        className="bg-green-100"
                    />
                ) : (
                    <Tile
                        label={t("store.cashOff")}
                        value={value(
                            cashOff === 0
                                ? "0"
                                : `${cashOff < 0 ? "−" : "+"}${plain(Math.abs(cashOff))}`,
                        )}
                        className={cashOff === 0 ? "bg-green-100" : "bg-red-100"}
                    />
                )}
            </div>
            {points &&
                (points.length > 0 ? (
                    <div className={TILE}>
                        <PanelLabel>
                            {t(single ? "store.cupsByHour" : "store.totalCups")}
                        </PanelLabel>
                        <div className="-mx-2 mt-2">
                            <AreaChart points={points} unit={t("store.cupsUnit")} height={120} />
                        </div>
                    </div>
                ) : (
                    <p className={`${TILE} text-sm text-gray-900`}>{t("store.noSales")}</p>
                ))}
        </Panel>
    );
}
