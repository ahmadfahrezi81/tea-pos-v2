import { LoadFailed } from "@tea-pos/shell/LoadFailed";
import { formatCalendarDay, formatMoney, localDate } from "@tea-pos/format";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { OrderCard } from "@tea-pos/shell/OrderCard";
import { useTenant } from "@tea-pos/shell/tenant";
import { AreaChart } from "@tea-pos/ui/AreaChart";
import { EmptyState } from "@tea-pos/ui/EmptyState";
import { LoadMore } from "@tea-pos/ui/LoadMore";
import { Skeleton } from "@tea-pos/ui/Skeleton";
import { Tile } from "@tea-pos/ui/Tile";
import { ReceiptText } from "lucide-react";

import { useDayOrders, useHours } from "./home";
import { DayBar, useSellerDay } from "./period";

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

/** A day's orders at the store (today unless picked, back to SellerEarliest): its totals, its cups by hour, every order. */
export function Orders() {
    const t = useT();
    const locale = useLocale();
    const [date] = useSellerDay();
    const { data: day } = useHours(date);
    const orders = useDayOrders(date);
    const store = useTenant()?.store;
    const list = orders.data ?? [];
    const title =
        date === localDate() ? t("orders.today") : formatCalendarDay(date, locale, "short");
    return (
        <div className="flex flex-col gap-3">
            <DayBar />
            {/* The totals and the cups by hour: one card. */}
            <div className="bg-white rounded-2xl">
                <div className="grid grid-cols-4 gap-1.5 p-3">
                    <Tile
                        label={t("analytics.orders")}
                        value={day && String(day.orders)}
                        className="bg-blue-100"
                        color="text-blue-900"
                    />
                    <Tile
                        label={t("analytics.cups")}
                        value={day && String(day.cups)}
                        className="bg-orange-100"
                        color="text-orange-900"
                    />
                    <Tile
                        label={t("analytics.totalSales")}
                        value={day && formatMoney(day.sales)}
                        className="col-span-2 bg-green-100"
                        color="text-green-900"
                    />
                </div>
                {day && (
                    <div className="px-2 pb-1">
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
            </div>

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
