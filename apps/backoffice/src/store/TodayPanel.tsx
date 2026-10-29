import type { components } from "@tea-pos/api-client";
import { formatMoney } from "@tea-pos/format";
import { useT } from "@tea-pos/i18n/react";
import { rowIcon } from "@tea-pos/shell/Settings";
import { AreaChart } from "@tea-pos/ui/AreaChart";
import { Panel, PanelLabel } from "@tea-pos/ui/Panel";
import { Skeleton } from "@tea-pos/ui/Skeleton";
import { Banknote } from "lucide-react";

type Totals = { sales: number; cups: number; orders: number };

const TILE = "rounded-xl bg-slate-100 p-3";

/** Today, over one store or several: sales, Cups and Orders tiles, and cups by hour. */
export function TodayPanel({
    totals,
    hours,
}: {
    totals: Totals | undefined;
    hours: components["schemas"]["SalesHour"][] | undefined;
}) {
    const t = useT();
    return (
        <Panel icon={<Banknote {...rowIcon} />} title={t("store.todayLabel")}>
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
            {hours &&
                (hours.length > 0 ? (
                    <div className={TILE}>
                        <PanelLabel>{t("store.cupsByHour")}</PanelLabel>
                        <div className="-mx-2 mt-2">
                            <AreaChart
                                points={hours.map((h) => ({
                                    key: String(h.hour),
                                    label: `${String(h.hour).padStart(2, "0")}:00`,
                                    value: h.cups,
                                }))}
                                unit={t("store.cupsUnit")}
                                height={120}
                            />
                        </div>
                    </div>
                ) : (
                    <p className={`${TILE} text-sm text-gray-900`}>{t("store.noSalesToday")}</p>
                ))}
        </Panel>
    );
}
