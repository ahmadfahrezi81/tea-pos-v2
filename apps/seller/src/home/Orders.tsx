import { LoadFailed } from "@tea-pos/shell/LoadFailed";
import { addDays, formatCalendarDay, formatMoney, formatTime, localDate } from "@tea-pos/format";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { OrderCard } from "@tea-pos/shell/OrderCard";
import { AreaChart } from "@tea-pos/ui/AreaChart";
import { ICON } from "@tea-pos/ui/icon";
import { LoadMore } from "@tea-pos/ui/LoadMore";
import { Skeleton } from "@tea-pos/ui/Skeleton";
import { Calendar, CalendarDays, Receipt } from "lucide-react";
import { useState } from "react";

import { useDayOrders, useHours } from "./home";

const hourLabel = (h: number) => `${String(h).padStart(2, "0")}:00`;

/** A day's orders at the store: its totals, its cups by hour (only to look at), every order. */
export function Orders() {
    const t = useT();
    const locale = useLocale();
    const today = localDate();
    const [date, setDate] = useState(today);
    const { data: day } = useHours(date);
    const orders = useDayOrders(date);
    const list = orders.data ?? [];
    const title =
        date === today
            ? t("orders.today")
            : date === addDays(today, -1)
              ? t("orders.yesterday")
              : formatCalendarDay(date, locale, "short");
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
                    <h3 className="font-semibold text-gray-800">{t("orders.dailySummary")}</h3>
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

            <div className="bg-white p-4 rounded-2xl">
                <label className="block text-sm font-medium text-gray-700">
                    <CalendarDays size={16} className="inline mr-1" />
                    {t("orders.selectDate")}
                    <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value || today)}
                        className="mt-2 w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand/90 focus:outline-none"
                    />
                </label>
            </div>

            {day && day.hours.length > 0 && (
                <div className="bg-white rounded-2xl p-2 pb-1">
                    <AreaChart
                        points={day.hours.map((h) => ({
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
                <div className="bg-white p-8 rounded-2xl text-center">
                    <Calendar size={48} className="mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-600">{t("orders.noOrders")}</p>
                    <p className="text-sm text-gray-500 mt-1">{t("orders.noOrdersForDate")}</p>
                </div>
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
