import { formatCalendarDay, formatMoney } from "@tea-pos/format";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { AreaChart } from "@tea-pos/ui/AreaChart";
import { Panel, PanelLabel } from "@tea-pos/ui/Panel";
import { Skeleton } from "@tea-pos/ui/Skeleton";

import { useRange } from "./range";
import { useSalesDays, useSalesHours } from "./sales";

const TILE = "rounded-xl bg-slate-100 p-3";

/** A range over the picked stores: sales, Cups and Orders tiles, and cups by hour (one day) or by day. */
export function RangePanel({
    totals,
}: {
    totals: { sales: number; cups: number; orders: number } | undefined;
}) {
    const t = useT();
    const locale = useLocale();
    const { from, to, single, label } = useRange();
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
    return (
        <Panel title={label}>
            {totals ? (
                <p className="px-1 text-3xl font-bold text-gray-900">{formatMoney(totals.sales)}</p>
            ) : (
                <Skeleton className="h-9 w-44 rounded" />
            )}
            <div className="grid grid-cols-2 gap-2">
                {(["cups", "orders"] as const).map((k) => (
                    <div key={k} className={TILE}>
                        <p className="text-sm text-gray-900">{t(`store.${k}`)}</p>
                        <p className="text-xl font-bold text-gray-900">{totals?.[k] ?? "–"}</p>
                    </div>
                ))}
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
