import { formatMoney, localDate } from "@tea-pos/format";
import { useT } from "@tea-pos/i18n/react";
import { useFirstMonth, useSlug } from "@tea-pos/shell/tenant";
import { AreaChart } from "@tea-pos/ui/AreaChart";
import { LoadMore } from "@tea-pos/ui/LoadMore";
import { Link, useNavigate } from "@tanstack/react-router";
import { CalendarDays, ReceiptText } from "lucide-react";

import { RangeBar, useRange } from "./range";
import { useRangeOrders, useSalesHours, useScopeStores, useStoreId } from "./sales";
import { Skeleton, SkeletonChart } from "@tea-pos/ui/Skeleton";
import { EmptyState } from "@tea-pos/ui/EmptyState";
import { Tile } from "@tea-pos/ui/Tile";
import { OrderCard } from "@tea-pos/shell/OrderCard";

const hourLabel = (h: number) => `${String(h).padStart(2, "0")}:00`;

/** The browser's own date picker, as the old app's. */
function DatePicker({ date, onChange }: { date: string; onChange: (date: string) => void }) {
    const t = useT();
    const firstMonth = useFirstMonth();
    return (
        <div className="bg-white p-4 rounded-2xl">
            <label className="block text-sm font-medium text-gray-700">
                <CalendarDays size={16} className="inline mr-1" />
                {t("orders.selectDate")}
                <input
                    type="date"
                    value={date}
                    min={`${firstMonth}-01`}
                    max={localDate()}
                    onChange={(e) => onChange(e.target.value || localDate())}
                    className="mt-2 w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand/90 focus:outline-none"
                />
            </label>
        </div>
    );
}

/**
 * The old seller app's Orders for the picked stores and range: the totals, on one day cups by hour, and every
 * order with its items, a page at a time; new orders arrive live.
 */
export function StoreOrders() {
    const t = useT();
    const slug = useSlug();
    const storeId = useStoreId();
    const { from, to, label, single } = useRange();
    const { totals } = useScopeStores(from, to);
    const hours = useSalesHours(single ? from : "");
    const orders = useRangeOrders(from, to);
    const list = orders.data ?? [];

    return (
        <div className="flex flex-col gap-3">
            <RangeBar />
            {/* The totals and, on one day, the cups by hour: one card. */}
            <div className="bg-white rounded-2xl">
                <div className="grid grid-cols-4 gap-1.5 p-3">
                    <Tile
                        label={t("analytics.orders")}
                        value={totals && String(totals.orders)}
                        className="bg-blue-100"
                        color="text-blue-900"
                    />
                    <Tile
                        label={t("analytics.cups")}
                        value={totals && String(totals.cups)}
                        className="bg-orange-100"
                        color="text-orange-900"
                    />
                    <Tile
                        label={t("analytics.totalSales")}
                        value={totals && formatMoney(totals.sales)}
                        className="col-span-2 bg-green-100"
                        color="text-green-900"
                    />
                </div>
                {single && hours.data && hours.data.hours.length > 0 && (
                    <Link
                        to="/$tenant/store/$storeId/orders/chart"
                        params={{ tenant: slug, storeId }}
                        search={{ date: from }}
                        className="block px-2 pb-1"
                    >
                        <AreaChart
                            points={hours.data.hours.map((h) => ({
                                key: String(h.hour),
                                label: hourLabel(h.hour),
                                value: h.cups,
                            }))}
                            unit={t("orders.cups")}
                            height={130}
                        />
                    </Link>
                )}
            </div>

            {orders.isPending ? (
                Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} delay={i * 80} className="h-24 rounded-2xl" />
                ))
            ) : list.length === 0 ? (
                <EmptyState
                    title={t("orders.noOrders")}
                    body={t("orders.noOrdersForDate")}
                    icon={ReceiptText}
                />
            ) : (
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-800">{label}</h3>
                        <span className="text-sm text-gray-500">
                            {totals?.orders ?? list.length} {t("analytics.orders").toLowerCase()}
                        </span>
                    </div>
                    {list.map((order, i) => (
                        <OrderCard
                            key={order.id}
                            order={order}
                            number={(totals?.orders ?? list.length) - i}
                        />
                    ))}
                    <LoadMore
                        hasMore={!!orders.hasNextPage}
                        loading={orders.isFetchingNextPage}
                        onMore={() => void orders.fetchNextPage()}
                        label={t("common.loadMore")}
                    />
                </div>
            )}
        </div>
    );
}

export function OrdersChart({ date }: { date: string }) {
    const t = useT();
    const navigate = useNavigate();
    const slug = useSlug();
    const storeId = useStoreId();
    const { data } = useSalesHours(date);
    return (
        <div className="space-y-4">
            <DatePicker
                date={date}
                onChange={(d) =>
                    void navigate({
                        to: "/$tenant/store/$storeId/orders/chart",
                        params: { tenant: slug, storeId },
                        search: { date: d },
                        replace: true,
                    })
                }
            />
            <div className="bg-white rounded-2xl p-4">
                <div className="flex items-start justify-between mb-3">
                    <div>
                        <h3 className="font-semibold text-gray-800 text-lg">
                            {t("orders.hourlySales")}
                        </h3>
                        <p className="text-sm text-gray-400">{t("orders.hourlySalesSubtitle")}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-gray-800">{t("analytics.total")}</p>
                        {data ? (
                            <p className="text-2xl font-bold text-brand">{data.cups}</p>
                        ) : (
                            <Skeleton className="ml-auto mt-1 h-7 w-10 rounded" />
                        )}
                    </div>
                </div>
                {!data ? (
                    <SkeletonChart height={220} />
                ) : data.hours.length === 0 ? (
                    <p className="py-12 text-center text-sm text-gray-500">
                        {t("orders.noSalesData")}
                    </p>
                ) : (
                    <AreaChart
                        points={data.hours.map((h) => ({
                            key: String(h.hour),
                            label: hourLabel(h.hour),
                            value: h.cups,
                        }))}
                        unit={t("orders.cups")}
                        height={220}
                        slot={64}
                    />
                )}
            </div>
        </div>
    );
}
