import type { components } from "@tea-pos/api-client";
import { formatDay, formatMoney } from "@tea-pos/format";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { Badge } from "@tea-pos/ui/Badge";
import { ICON } from "@tea-pos/ui/icon";
import { Sheet } from "@tea-pos/ui/Sheet";
import { Link } from "@tanstack/react-router";
import { History, Info, MoreVertical } from "lucide-react";
import type { ReactNode } from "react";

import { Sellers } from "./Sellers";

type Day = components["schemas"]["Day"];

/** A day's menu, in both apps: its Details (with its sessions) and its Activity. */
export function DayMenu({
    day,
    onClose,
    title,
    base,
}: {
    day: Day | null;
    onClose: () => void;
    title: string;
    /** The day's address; Activity is under it. */
    base: string;
}) {
    const t = useT();
    return (
        <Sheet open={!!day} onClose={onClose} title={title}>
            {day &&
                [
                    { icon: Info, label: t("analytics.details"), to: base },
                    { icon: History, label: t("analytics.activity"), to: `${base}/activity` },
                ].map((item, i, all) => (
                    <Link
                        key={item.label}
                        to={item.to}
                        onClick={onClose}
                        className={`w-full flex items-center gap-3 py-5 ${i < all.length - 1 ? "border-b" : ""}`}
                    >
                        <item.icon size={ICON} strokeWidth={2} className="text-gray-900" />
                        <span className="text-lg text-gray-900">{item.label}</span>
                    </Link>
                ))}
        </Sheet>
    );
}

/** One store's day in a list: its cash, who worked, its expenses; `children` at its foot. */
export function DayCard({
    day,
    storeName,
    onMenu,
    children,
}: {
    day: Day;
    storeName?: boolean;
    onMenu: () => void;
    children?: ReactNode;
}) {
    const t = useT();
    const locale = useLocale();
    const cell = (label: string, value: string, color: string) => (
        <div>
            <p className="text-xs">{label}</p>
            <p className={`text-lg font-extrabold ${color}`}>{value}</p>
        </div>
    );
    return (
        <div id={`day-${day.id}`} className="bg-white rounded-2xl overflow-hidden">
            <div className="p-3 space-y-3">
                <div className="flex justify-between items-start">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h3 className="text-xl font-bold text-gray-800">
                                {formatDay(day.date, locale)}
                            </h3>
                            <Badge>
                                {t(
                                    day.closedAt
                                        ? "analytics.statusClosed"
                                        : "analytics.statusOpen",
                                )}
                            </Badge>
                        </div>
                        {storeName && (
                            <p className="text-sm text-gray-500 truncate">{day.storeName}</p>
                        )}
                    </div>
                    <button
                        onClick={onMenu}
                        aria-label={t("store.dayMenu")}
                        className="size-8 shrink-0 flex items-center justify-center text-gray-500 active:opacity-60 rounded-lg"
                    >
                        <MoreVertical size={ICON} strokeWidth={2.5} />
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-2 rounded-2xl p-2 bg-slate-100 text-gray-800">
                    {cell(
                        t("analytics.openingBalance"),
                        formatMoney(day.openingBalance),
                        "text-blue-600",
                    )}
                    {cell(t("analytics.totalSales"), formatMoney(day.sales), "text-green-600")}
                    {cell(
                        t("analytics.openingPlusSales"),
                        formatMoney(day.openingBalance + day.sales),
                        "text-purple-600",
                    )}
                    <div className="flex gap-4">
                        {cell(t("analytics.orders"), String(day.orders), "text-blue-600")}
                        {cell(t("analytics.cups"), String(day.cups), "text-orange-600")}
                    </div>
                    <hr className="col-span-2 border-gray-300" />
                    {cell(
                        t("analytics.expectedCash"),
                        formatMoney(day.expectedCash),
                        "text-purple-600",
                    )}
                    {cell(
                        t("analytics.actualCash"),
                        day.actualCash === null
                            ? t("analytics.notCounted")
                            : formatMoney(day.actualCash),
                        "text-orange-600",
                    )}
                </div>

                <Sellers sellers={day.sellers} />

                {day.expenseItems.length > 0 && (
                    <div>
                        <h4 className="text-gray-800 text-sm font-semibold mb-1">
                            {t("analytics.expensesOfDay")}
                        </h4>
                        <div className="bg-red-100 p-2 rounded-xl">
                            {day.expenseItems.map((e) => (
                                <div
                                    key={e.id}
                                    className="flex justify-between text-sm font-semibold text-red-800"
                                >
                                    <span>{e.type}</span>
                                    <span>-{formatMoney(e.amount)}</span>
                                </div>
                            ))}
                            <div className="border-t border-red-300 mt-1 pt-1 flex justify-between font-extrabold text-red-800">
                                <span>{t("analytics.total")}</span>
                                <span>-{formatMoney(day.expenses)}</span>
                            </div>
                        </div>
                    </div>
                )}

                {day.variance !== null && (
                    <div>
                        <h4 className="text-gray-800 text-sm font-semibold mb-1">
                            {t("analytics.variance")}
                        </h4>
                        <p
                            className={`text-sm px-3 py-2 rounded-xl font-bold ${
                                day.variance >= 0
                                    ? "bg-green-100 text-green-800"
                                    : "bg-red-100 text-red-800"
                            }`}
                        >
                            {day.variance >= 0 ? "+" : ""}
                            {formatMoney(day.variance)}
                        </p>
                    </div>
                )}

                {day.notes && (
                    <div>
                        <h4 className="text-gray-800 text-sm font-semibold mb-1">
                            {t("analytics.notes")}
                        </h4>
                        <p className="text-sm text-gray-700 bg-slate-100 p-2 rounded-xl">
                            {day.notes}
                        </p>
                    </div>
                )}
            </div>
            {children}
        </div>
    );
}
