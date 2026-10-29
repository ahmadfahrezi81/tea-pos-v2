import { formatDate, formatMoney } from "@tea-pos/format";
import type { MessageKey } from "@tea-pos/i18n";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { useSlug } from "@tea-pos/shell/tenant";
import { AreaChart } from "@tea-pos/ui/AreaChart";
import { BarChart } from "@tea-pos/ui/BarChart";
import { useNavigate } from "@tanstack/react-router";
import { Package } from "lucide-react";
import type { ReactNode } from "react";

import { MonthPicker } from "./AnalyticsMonth";
import { monthRange, useSalesDays, useSalesProducts, useStoreId, useTeaWaste } from "./sales";

// Tea waste, as the old app judged it: up to 12 L a day is fine, and a litre costs Rp 1.000.
const TARGET_LITRES = 12;
const COST_PER_LITRE = 1000;
const GOOD = "#16a34a";
const BAD = "#dc2626";

// Monday first; Date's getUTCDay counts from Sunday.
const WEEK = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
] as const;

/** The old seller app's charts page for the picked stores: daily sales, tea waste, day of week, products. */
export function AnalyticsCharts({ month }: { month: string }) {
    const slug = useSlug();
    const storeId = useStoreId();
    const navigate = useNavigate();
    const [from, to] = monthRange(month);
    return (
        <div className="space-y-4">
            <MonthPicker
                month={month}
                onChange={(m) =>
                    void navigate({
                        to: "/$tenant/store/$storeId/analytics/charts",
                        params: { tenant: slug, storeId },
                        search: { month: m },
                        replace: true,
                    })
                }
            />
            <DailySales from={from} to={to} />
            <TeaWaste from={from} to={to} />
            <DayOfWeek from={from} to={to} />
            <Products from={from} to={to} />
        </div>
    );
}

function Card({
    title,
    subtitle,
    aside,
    children,
}: {
    title: string;
    subtitle: string;
    aside?: ReactNode;
    children: ReactNode;
}) {
    return (
        <div className="bg-white rounded-2xl p-4">
            <div className="flex items-start justify-between mb-3">
                <div>
                    <h3 className="font-semibold text-gray-800 text-lg">{title}</h3>
                    <p className="text-sm text-gray-400">{subtitle}</p>
                </div>
                {aside}
            </div>
            {children}
        </div>
    );
}

function Aside({
    label,
    value,
    color = "text-brand",
}: {
    label: string;
    value: string;
    color?: string;
}) {
    return (
        <div className="text-right shrink-0">
            <p className="text-xs text-gray-800">{label}</p>
            <p className={`text-2xl font-bold whitespace-nowrap ${color}`}>{value}</p>
        </div>
    );
}

function Breakdown({
    title,
    rows,
}: {
    title: string;
    rows: { label: string; value: ReactNode; strong?: boolean }[];
}) {
    return (
        <div className="mt-4 rounded-xl bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</p>
            <dl className="mt-2 space-y-1.5 text-sm">
                {rows.map((r) => (
                    <div
                        key={r.label}
                        className={`flex items-baseline justify-between ${r.strong ? "border-t border-slate-200 pt-2" : ""}`}
                    >
                        <dt className={r.strong ? "font-medium text-gray-700" : "text-gray-500"}>
                            {r.label}
                        </dt>
                        <dd
                            className={
                                r.strong
                                    ? "text-base font-bold text-brand"
                                    : "font-medium text-gray-700"
                            }
                        >
                            {r.value}
                        </dd>
                    </div>
                ))}
            </dl>
        </div>
    );
}

const Loading = ({ height }: { height: number }) => (
    <div className="bg-white rounded-2xl" style={{ height }} />
);

function DailySales({ from, to }: { from: string; to: string }) {
    const t = useT();
    const locale = useLocale();
    const { data } = useSalesDays(from, to);
    if (!data) return <Loading height={300} />;
    const days = data.days.filter((d) => d.cups > 0);
    if (days.length === 0) return null;
    const total = days.reduce((sum, d) => sum + d.cups, 0);
    const high = days.reduce((a, d) => (d.cups > a.cups ? d : a));
    const low = days.reduce((a, d) => (d.cups < a.cups ? d : a));
    return (
        <Card
            title={t("analytics.dailySalesTitle")}
            subtitle={t("analytics.dailySalesSubtitle")}
            aside={<Aside label={t("analytics.total")} value={String(total)} />}
        >
            <AreaChart
                points={days.map((d) => ({
                    key: d.date,
                    label: formatDate(d.date, locale),
                    value: d.cups,
                }))}
                unit={t("orders.cups")}
                height={220}
                slot={72}
            />
            <Breakdown
                title={t("analytics.dailySalesBreakdownTitle")}
                rows={[
                    {
                        label: t("analytics.highestDay"),
                        value: dayValue(high.cups, formatDate(high.date, locale)),
                    },
                    {
                        label: t("analytics.lowestDay"),
                        value: dayValue(low.cups, formatDate(low.date, locale)),
                    },
                    {
                        label: t("analytics.avgPerDay"),
                        value: Math.round(total / days.length),
                        strong: true,
                    },
                ]}
            />
        </Card>
    );
}

const dayValue = (cups: number, date: string) => (
    <>
        {cups} <span className="text-gray-400">{date}</span>
    </>
);

function TeaWaste({ from, to }: { from: string; to: string }) {
    const t = useT();
    const locale = useLocale();
    const { data } = useTeaWaste(from, to);
    if (!data) return <Loading height={300} />;
    if (data.days.length === 0) return null;
    const litres = Math.round(data.days.reduce((sum, d) => sum + d.litres, 0) * 10) / 10;
    const cost = litres * COST_PER_LITRE;
    return (
        <Card
            title={t("analytics.teaWasteTitle")}
            subtitle={t("analytics.teaWasteSubtitle")}
            aside={<Aside label={t("analytics.total")} value={`${litres}L`} color="text-red-600" />}
        >
            <BarChart
                points={data.days.map((d) => ({
                    key: d.date,
                    label: formatDate(d.date, locale),
                    value: d.litres,
                    color: d.litres > TARGET_LITRES ? BAD : GOOD,
                }))}
                line={TARGET_LITRES}
                unit="L"
                format={(v) => String(Math.round(v * 10) / 10)}
                height={220}
            />
            <Breakdown
                title={t("analytics.teaWasteCostTitle")}
                rows={[
                    { label: t("analytics.teaWasteLitresWasted"), value: `${litres} L` },
                    {
                        label: t("analytics.teaWasteCostPerLitre"),
                        value: formatMoney(COST_PER_LITRE),
                    },
                    {
                        label: t("analytics.avgPerDay"),
                        value: formatMoney(Math.round(cost / data.days.length)),
                    },
                    {
                        label: t("analytics.teaWasteTotalCost"),
                        value: formatMoney(cost),
                        strong: true,
                    },
                ]}
            />
        </Card>
    );
}

/** Average cups per weekday, from the same days as daily sales (no route of its own). */
function DayOfWeek({ from, to }: { from: string; to: string }) {
    const t = useT();
    const { data } = useSalesDays(from, to);
    if (!data) return <Loading height={372} />;
    const buckets = WEEK.map(() => ({ cups: 0, days: 0 }));
    for (const d of data.days) {
        if (d.cups <= 0) continue;
        const b = buckets[(new Date(`${d.date}T00:00:00Z`).getUTCDay() + 6) % 7]!;
        b.cups += d.cups;
        b.days += 1;
    }
    const rows = WEEK.map((day, i) => ({
        day,
        avg: buckets[i]!.days ? buckets[i]!.cups / buckets[i]!.days : 0,
    }));
    if (rows.every((r) => r.avg === 0)) return null;
    const best = rows.reduce((a, r) => (r.avg > a.avg ? r : a));
    const name = (day: string) => t(`common.weekdaysFull.${day}` as MessageKey);
    return (
        <Card
            title={t("analytics.dayOfWeek")}
            subtitle={t("analytics.avgCupsByDay")}
            aside={<Aside label={t("analytics.bestDay")} value={name(best.day)} />}
        >
            <div className="space-y-2">
                {rows.map((r) => (
                    <div key={r.day} className="flex items-center gap-2">
                        <div className="flex-1 h-9 rounded bg-gray-100 overflow-hidden">
                            <div
                                className={`h-full rounded flex items-center px-2 text-sm font-semibold text-white whitespace-nowrap ${
                                    r.day === best.day ? "bg-brand" : "bg-gray-600"
                                }`}
                                style={{ width: `${Math.max((r.avg / best.avg) * 100, 30)}%` }}
                            >
                                {name(r.day)}
                            </div>
                        </div>
                        <span className="w-10 text-right text-xs text-gray-700">
                            {Math.round(r.avg)}
                        </span>
                    </div>
                ))}
            </div>
        </Card>
    );
}

function Products({ from, to }: { from: string; to: string }) {
    const t = useT();
    const { data } = useSalesProducts(from, to);
    if (!data) return <Loading height={300} />;
    const products = data.products;
    if (products.length === 0) return null;
    const total = products.reduce((sum, p) => sum + p.quantity, 0);
    return (
        <Card title={t("store.productSales")} subtitle={t("store.productSalesSubtitle")}>
            <div className="space-y-4 mb-4">
                {products.map((p, i) => {
                    const share = Math.round((p.quantity / total) * 1000) / 10;
                    return (
                        <div key={p.id} className="space-y-1.5">
                            <div className="flex items-center justify-between text-sm">
                                <span className="font-medium text-gray-800">{p.name}</span>
                                <span className="text-gray-500">
                                    {p.quantity} {t("orders.cups")} ({share}%)
                                </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded h-4">
                                <div
                                    className="h-4 rounded"
                                    style={{
                                        width: `${share}%`,
                                        backgroundColor: `hsl(${(i * 360) / products.length}, 70%, 55%)`,
                                    }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="flex flex-col gap-2 text-sm pt-3 border-t border-gray-100">
                <div className="flex gap-2 leading-none font-medium text-gray-800">
                    <Package className="h-4 w-4 shrink-0" />
                    {t("store.productsSold").replace("{n}", String(products.length))}
                </div>
                <div className="text-gray-500 leading-none">
                    {t("analytics.total")}: {total} {t("orders.cups")}
                </div>
            </div>
        </Card>
    );
}
