import { LoadFailed } from "@tea-pos/shell/LoadFailed";
import { formatMoney, formatTime, localDate } from "@tea-pos/format";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { OrderCard } from "@tea-pos/shell/OrderCard";
import { useTenant } from "@tea-pos/shell/tenant";
import { AreaChart } from "@tea-pos/ui/AreaChart";
import { EmptyState } from "@tea-pos/ui/EmptyState";
import { ICON } from "@tea-pos/ui/icon";
import { LoadMore } from "@tea-pos/ui/LoadMore";
import { Skeleton } from "@tea-pos/ui/Skeleton";
import { Receipt, ReceiptText } from "lucide-react";

import { useDayOrders, useHours } from "./home";

const hourLabel = (h: number) => `${String(h).padStart(2, "0")}:00`;

/** The store's opening hours at 0 cups, so a day without orders still shows its chart. */
function emptyHours(open = "", close = "") {
    const from = Number(open.split(":")[0]) || 10;
    const to = Number(close.split(":")[0]) || 22;
    return Array.from({ length: Math.max(to - from + 1, 1) }, (_, i) => ({
        hour: from + i,
        cups: 0,
    }));
}

/** Today's orders at the store: its totals, its cups by hour (only to look at), every order. Earlier days are the backoffice's. */
export function Orders() {
    const t = useT();
    const locale = useLocale();
    const today = localDate();
    const date = today;
    const { data: day } = useHours(date);
    const orders = useDayOrders(date);
    const store = useTenant()?.store;
    const list = orders.data ?? [];
    const title = t("orders.today");
    const figure = (value: number | undefined, label: string, color: string) => (
        <div className="text-center">
            {value === undefined ? (
                <Skeleton className="mx-auto h-7 w-8 rounded" />
            ) : (
                <p className={`text-xl font-bold ${color}`}>{value}</p>
            )}
            <p className="text-sm text-gray-600">{label}</p>
        </div>
    );
    return (
        <div className="flex flex-col gap-4">
            <div className="bg-white p-4 rounded-2xl">
                <div className="flex items-center gap-2 mb-3">
                    <Receipt size={ICON} className="text-gray-600" />
                    <h3 className="font-semibold text-gray-800">{t("orders.totalToday")}</h3>
                </div>
                <div className="grid grid-cols-4 gap-2">
                    {figure(day?.orders, t("analytics.orders"), "text-blue-600")}
                    {figure(day?.cups, t("analytics.cups"), "text-orange-600")}
                    <div className="text-center col-span-2 border-l-2 border-gray-300">
                        <p className="text-sm text-gray-600">{t("analytics.totalSales")}</p>
                        {day ? (
                            <p className="text-xl font-bold text-green-600">
                                {formatMoney(day.sales)}
                            </p>
                        ) : (
                            <Skeleton className="mx-auto mt-1 h-7 w-24 rounded" />
                        )}
                    </div>
                </div>
            </div>

            {day && (
                <div className="bg-white rounded-2xl p-2 pb-1">
                    <AreaChart
                        points={(day.hours.length > 0
                            ? day.hours
                            : emptyHours(store?.openTime, store?.closeTime)
                        ).map((h) => ({
                            key: String(h.hour),
                            label: hourLabel(h.hour),
                            value: h.cups,
                        }))}
                        unit={t("orders.cups")}
                        height={130}
                    />
                </div>
            )}

            {orders.error && list.length === 0 ? (
                <LoadFailed error={orders.error} />
            ) : orders.isPending ? (
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
                        <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
                        <span className="text-sm text-gray-500">
                            {day?.orders ?? list.length} {t("analytics.orders").toLowerCase()}
                        </span>
                    </div>
                    {list.map((order, i) => (
                        <OrderCard
                            key={order.id}
                            order={order}
                            number={(day?.orders ?? list.length) - i}
                            time={formatTime(order.at, locale)}
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
