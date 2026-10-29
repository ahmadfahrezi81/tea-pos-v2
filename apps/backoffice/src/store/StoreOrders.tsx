import { formatDateTime, formatDay, formatMoney, formatTime, localDate } from "@tea-pos/format";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { useTenant } from "@tea-pos/shell/tenant";
import { AreaChart } from "@tea-pos/ui/AreaChart";
import { LoadMore } from "@tea-pos/ui/LoadMore";
import { Link, useNavigate } from "@tanstack/react-router";
import { CalendarDays, Receipt } from "lucide-react";

import { useDayOrders, useSalesHours, useStoreId } from "./sales";
import { Skeleton } from "@tea-pos/ui/Skeleton";
import { ICON } from "@tea-pos/ui/icon";
import { EmptyState } from "@tea-pos/ui/EmptyState";

const hourLabel = (h: number) => `${String(h).padStart(2, "0")}:00`;

/** The browser's own date picker, as the old app's. */
function DatePicker({ date, onChange }: { date: string; onChange: (date: string) => void }) {
    const t = useT();
    return (
        <div className="bg-white p-4 rounded-2xl">
            <label className="block text-sm font-medium text-gray-700">
                <CalendarDays size={16} className="inline mr-1" />
                {t("orders.selectDate")}
                <input
                    type="date"
                    value={date}
                    onChange={(e) => onChange(e.target.value || localDate())}
                    className="mt-2 w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand/90 focus:outline-none"
                />
            </label>
        </div>
    );
}

/**
 * The old seller app's Orders for the picked stores: the day's totals, cups by hour, and every
 * order with its items, a page at a time; new orders arrive live.
 */
export function StoreOrders({ date }: { date: string }) {
    const t = useT();
    const locale = useLocale();
    const navigate = useNavigate();
    const slug = useTenant()?.tenant.slug ?? "";
    const storeId = useStoreId();
    const severalStores = !useTenant()?.store;
    const hours = useSalesHours(date);
    const orders = useDayOrders(date);
    const totals = hours.data;
    const list = orders.data ?? [];

    return (
        <div className="flex flex-col gap-4">
            <div className="bg-white p-4 rounded-2xl">
                <div className="flex items-center gap-2 mb-3">
                    <Receipt size={ICON} className="text-gray-600" />
                    <h3 className="font-semibold text-gray-800">{t("orders.dailySummary")}</h3>
                </div>
                <div className="grid grid-cols-4 gap-2">
                    <Figure
                        label={t("analytics.orders")}
                        value={totals && String(totals.orders)}
                        color="text-blue-600"
                    />
                    <Figure
                        label={t("analytics.cups")}
                        value={totals && String(totals.cups)}
                        color="text-orange-600"
                    />
                    <div className="text-center col-span-2 border-l-2 border-gray-300">
                        <p className="text-sm text-gray-600">{t("analytics.totalSales")}</p>
                        {totals ? (
                            <p className="text-xl font-bold text-green-600">
                                {formatMoney(totals.sales)}
                            </p>
                        ) : (
                            <Skeleton className="mx-auto mt-1 h-7 w-24 rounded" />
                        )}
                    </div>
                </div>
            </div>

            <DatePicker
                date={date}
                onChange={(d) =>
                    void navigate({
                        to: "/$tenant/store/$storeId/orders",
                        params: { tenant: slug, storeId },
                        search: { date: d },
                        replace: true,
                    })
                }
            />

            {totals && totals.hours.length > 0 && (
                <Link
                    to="/$tenant/store/$storeId/orders/chart"
                    params={{ tenant: slug, storeId }}
                    search={{ date }}
                    className="block bg-white rounded-2xl p-2 pb-1"
                >
                    <AreaChart
                        points={totals.hours.map((h) => ({
                            key: String(h.hour),
                            label: hourLabel(h.hour),
                            value: h.cups,
                        }))}
                        unit={t("orders.cups")}
                        height={130}
                    />
                </Link>
            )}

            {orders.isPending ? (
                Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} delay={i * 80} className="h-24 rounded-2xl" />
                ))
            ) : list.length === 0 ? (
                <EmptyState title={t("orders.noOrders")} body={t("orders.noOrdersForDate")} />
            ) : (
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-800">
                            {formatDay(date, locale)}
                        </h3>
                        <span className="text-sm text-gray-500">
                            {totals?.orders ?? list.length} {t("analytics.orders").toLowerCase()}
                        </span>
                    </div>
                    {list.map((order, i) => (
                        <div key={order.id} className="bg-white rounded-2xl overflow-hidden">
                            <div className="p-3.5 flex justify-between items-start">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        {/* Numbered against the day, newest highest, however many pages are loaded. */}
                                        <p className="text-lg font-bold text-gray-800">
                                            {t("store.orderNumber").replace(
                                                "{n}",
                                                String((totals?.orders ?? list.length) - i),
                                            )}
                                        </p>
                                        {order.paymentMethod === "qris" && (
                                            <span className="bg-blue-600 text-white px-2.5 py-0.5 rounded-full text-xs font-bold">
                                                QRIS
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-sm text-gray-500">
                                        {formatTime(order.at, locale)}
                                        {severalStores ? ` · ${order.storeName}` : ""}
                                    </span>
                                </div>
                                <div className="text-right">
                                    <p className="text-lg font-bold text-green-600">
                                        {formatMoney(order.total)}
                                    </p>
                                    <p className="text-sm text-gray-500">
                                        {order.cups} {t("orders.cups")}
                                    </p>
                                </div>
                            </div>
                            <div className="border-t border-gray-100 p-3 bg-slate-100 space-y-3">
                                <div>
                                    <h4 className="font-medium text-gray-800 mb-2 text-sm">
                                        {t("orders.orderDetails")}
                                    </h4>
                                    <div className="text-xs text-gray-800 space-y-1">
                                        <p className="break-all">
                                            <span className="font-medium">ID:</span> {order.id}
                                        </p>
                                        {order.seller && (
                                            <p>
                                                <span className="font-medium">
                                                    {t("orders.seller")}:
                                                </span>{" "}
                                                {order.seller}
                                            </p>
                                        )}
                                        <p>
                                            <span className="font-medium">
                                                {t("orders.fullTimestamp")}:
                                            </span>{" "}
                                            {formatDateTime(order.at, locale)}
                                        </p>
                                    </div>
                                </div>
                                <div>
                                    <h4 className="font-medium text-gray-800 mb-1 text-sm">
                                        {t("orders.items")}
                                    </h4>
                                    <div className="space-y-2">
                                        {order.items.map((item) => (
                                            <div
                                                key={item.id}
                                                className="flex justify-between items-center bg-white p-2.5 rounded-xl text-sm"
                                            >
                                                <div className="flex-1">
                                                    <p className="font-medium">
                                                        {item.name || t("common.unknown")}
                                                    </p>
                                                    <p className="text-xs text-gray-500">
                                                        {formatMoney(item.unitPrice)}{" "}
                                                        {t("orders.each")}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-medium">x{item.quantity}</p>
                                                    <p className="text-xs text-gray-600">
                                                        {formatMoney(item.totalPrice)}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
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

function Figure({
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

/** The old seller app's orders chart: a day's cups by hour, larger, with its total. */
export function OrdersChart({ date }: { date: string }) {
    const t = useT();
    const navigate = useNavigate();
    const slug = useTenant()?.tenant.slug ?? "";
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
                        <p className="text-2xl font-bold text-brand">{data?.cups ?? "–"}</p>
                    </div>
                </div>
                {!data ? (
                    <div className="h-[220px]" />
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
