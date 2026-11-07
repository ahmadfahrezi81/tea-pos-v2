import type { components } from "@tea-pos/api-client";
import { formatDateTime, formatMoney } from "@tea-pos/format";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { Avatar } from "@tea-pos/ui/Avatar";
import { Badge } from "@tea-pos/ui/Badge";
import { CopyButton } from "@tea-pos/ui/CopyButton";
import { ICON } from "@tea-pos/ui/icon";
import { Sheet } from "@tea-pos/ui/Sheet";
import { MoreVertical } from "lucide-react";
import { useState } from "react";

type Order = components["schemas"]["Order"];

/**
 * One order with its items, in both apps, read like a receipt: which order, what was in it, what it
 * came to: when and where, then who. ⋮ opens its ID. `number` counts against the whole list, newest highest.
 */
export function OrderCard({ order, number }: { order: Order; number: number }) {
    const t = useT();
    const locale = useLocale();
    const [menu, setMenu] = useState(false);
    const title = t("store.orderNumber").replace("{n}", String(number));
    return (
        <div className="bg-white rounded-2xl p-3.5 space-y-2.5">
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <p className="text-lg font-bold text-gray-900">{title}</p>
                        {order.paymentMethod === "qris" && <Badge>QRIS</Badge>}
                    </div>
                    <p className="text-sm text-gray-700 truncate">
                        {[formatDateTime(order.at, locale), order.storeName]
                            .filter(Boolean)
                            .join(" · ")}
                    </p>
                </div>
                <button
                    onClick={() => setMenu(true)}
                    aria-label={t("orders.menu")}
                    className="size-8 -mr-1.5 shrink-0 flex items-center justify-center text-gray-500 active:opacity-60 rounded-lg"
                >
                    <MoreVertical size={ICON} strokeWidth={2.5} />
                </button>
            </div>

            {order.seller && (
                <div className="flex w-fit max-w-full items-center gap-2 bg-slate-100 rounded-md p-1.5 pr-2.5">
                    <Avatar url={order.sellerAvatar} size={22} />
                    <p className="text-sm font-semibold text-gray-900 truncate">{order.seller}</p>
                </div>
            )}

            <div className="rounded-xl bg-slate-100 px-3 py-2">
                {order.items.map((item) => (
                    <div key={item.id} className="flex items-start gap-2 py-1.5 text-sm">
                        <span className="w-7 shrink-0 font-semibold text-gray-900">
                            {item.quantity}×
                        </span>
                        <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate">
                                {item.name || t("common.unknown")}
                            </p>
                            <p className="text-xs text-gray-700">
                                {formatMoney(item.unitPrice)} {t("orders.each")}
                            </p>
                        </div>
                        <span className="font-medium text-gray-900 whitespace-nowrap">
                            {formatMoney(item.totalPrice)}
                        </span>
                    </div>
                ))}
            </div>
            <div className="flex items-baseline justify-between border-t border-gray-100 pt-2.5 text-base font-bold">
                <span className="text-gray-900">
                    {t("store.total")} · {order.cups}{" "}
                    {t(order.cups === 1 ? "orders.cup" : "orders.cups")}
                </span>
                <span className="text-green-600">{formatMoney(order.total)}</span>
            </div>

            <OrderMenu order={order} title={title} open={menu} onClose={() => setMenu(false)} />
        </div>
    );
}

/** An order's ID to copy; edit and delete come with corrections. */
function OrderMenu({
    order,
    title,
    open,
    onClose,
}: {
    order: Order;
    title: string;
    open: boolean;
    onClose: () => void;
}) {
    return (
        <Sheet open={open} onClose={onClose} title={title}>
            <div className="flex items-center justify-between gap-3 py-3.5">
                <span className="text-gray-700">ID</span>
                <CopyButton
                    value={order.id}
                    className="flex items-center gap-1.5 active:opacity-70 min-w-0 text-gray-900"
                >
                    <span className="truncate font-mono text-xs">{order.id}</span>
                </CopyButton>
            </div>
        </Sheet>
    );
}
