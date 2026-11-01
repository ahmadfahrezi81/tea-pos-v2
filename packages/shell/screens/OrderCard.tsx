import type { components } from "@tea-pos/api-client";
import { formatDateTime, formatMoney } from "@tea-pos/format";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { Badge } from "@tea-pos/ui/Badge";

/** One order with its items, in both apps; `number` counts against the whole list, newest highest. */
export function OrderCard({
    order,
    number,
    time,
    place,
}: {
    order: components["schemas"]["Order"];
    number: number;
    time: string;
    place?: string;
}) {
    const t = useT();
    const locale = useLocale();
    return (
        <div className="bg-white rounded-2xl overflow-hidden">
            <div className="p-3.5 flex justify-between items-start">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <p className="text-lg font-bold text-gray-800">
                            {t("store.orderNumber").replace("{n}", String(number))}
                        </p>
                        {order.paymentMethod === "qris" && <Badge>QRIS</Badge>}
                    </div>
                    <span className="text-sm text-gray-500">
                        {time}
                        {place ? ` · ${place}` : ""}
                    </span>
                </div>
                <div className="text-right">
                    <p className="text-lg font-bold text-green-600">{formatMoney(order.total)}</p>
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
                                <span className="font-medium">{t("orders.seller")}:</span>{" "}
                                {order.seller}
                            </p>
                        )}
                        <p>
                            <span className="font-medium">{t("orders.fullTimestamp")}:</span>{" "}
                            {formatDateTime(order.at, locale)}
                        </p>
                    </div>
                </div>
                <div>
                    <h4 className="font-medium text-gray-800 mb-1 text-sm">{t("orders.items")}</h4>
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
                                        {formatMoney(item.unitPrice)} {t("orders.each")}
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
    );
}
