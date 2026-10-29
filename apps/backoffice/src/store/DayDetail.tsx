import type { components } from "@tea-pos/api-client";
import { formatCalendarDay, formatDateTime, formatMoney } from "@tea-pos/format";
import type { MessageKey } from "@tea-pos/i18n";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { ImageOff, X } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Sellers } from "./Sellers";
import { useDay } from "./sales";
import { Dialog } from "@tea-pos/ui/Drawer";
import { Badge } from "@tea-pos/ui/Badge";
import { SectionLabel } from "@tea-pos/ui/SectionLabel";

type Photo = components["schemas"]["DayPhoto"];

// The closing photos, in the old app's order.
const CLOSING = [
    "closing:ice",
    "closing:syrup",
    "closing:bags",
    "closing:cups",
    "closing:tea",
] as const;

/** One store's day, as the old seller app's Details: cash, expenses, who worked, notes, photos, products. */
export function DayDetail({ id }: { id: string }) {
    const t = useT();
    const locale = useLocale();
    const { data: day, error } = useDay(id);
    if (error)
        return (
            <p className="bg-white rounded-2xl p-4 text-sm text-gray-600">
                {t("errors.day_not_found")}
            </p>
        );
    if (!day)
        return (
            <div className="space-y-4">
                {[160, 320, 120].map((h) => (
                    <div key={h} className="bg-white rounded-2xl" style={{ height: h }} />
                ))}
            </div>
        );

    const row = (label: string, value: string) => (
        <div className="flex justify-between gap-3">
            <span className="text-gray-500">{label}</span>
            <span className="font-medium text-gray-800 text-right">{value}</span>
        </div>
    );
    const opening = day.photos.find((p) => p.type === "opening");
    const closing = CLOSING.map((type) => day.photos.find((p) => p.type === type)).filter(
        (p): p is Photo => !!p,
    );

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-2xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-xl text-gray-800 leading-tight">
                        {formatCalendarDay(day.date, locale, "long")}
                    </h3>
                    <Badge>
                        {t(day.closedAt ? "analytics.statusClosed" : "analytics.statusOpen")}
                    </Badge>
                </div>
                <div className="text-sm space-y-1.5">
                    {row(t("daily.store"), day.storeName)}
                    {day.openedBy && row(t("daily.openedBy"), day.openedBy)}
                    {day.closedAt && day.closedBy && row(t("daily.closedBy"), day.closedBy)}
                    {day.openedAt && row(t("daily.openedAt"), formatDateTime(day.openedAt, locale))}
                    {day.closedAt && row(t("daily.closedAt"), formatDateTime(day.closedAt, locale))}
                </div>
            </div>

            <div className="bg-white rounded-2xl p-3 space-y-2">
                <h4 className="text-sm font-semibold text-gray-800">{t("daily.cashSummary")}</h4>
                <Tile
                    label={t("analytics.openingBalance")}
                    value={formatMoney(day.openingBalance)}
                    tone="bg-blue-100 text-blue-900"
                />
                <div className="grid grid-cols-4 gap-2">
                    <Tile
                        label={`+ ${t("analytics.totalSales")}`}
                        value={formatMoney(day.sales)}
                        tone="bg-green-100 text-green-900"
                        className="col-span-2"
                    />
                    <Tile
                        label={t("analytics.orders")}
                        value={String(day.orders)}
                        tone="bg-violet-100 text-violet-900"
                    />
                    <Tile
                        label={t("analytics.cups")}
                        value={String(day.cups)}
                        tone="bg-orange-100 text-orange-900"
                    />
                </div>
                <Tile
                    label={`${t("analytics.openingBalance")} + ${t("analytics.totalSales")}`}
                    value={formatMoney(day.openingBalance + day.sales)}
                    tone="bg-blue-100 text-blue-900"
                />
                <hr className="border-gray-200" />
                <Tile
                    label={`− ${t("daily.expenses")}`}
                    value={formatMoney(day.expenses)}
                    tone="bg-red-100 text-red-900"
                />
                <hr className="border-gray-200 my-2" />
                <div className="grid grid-cols-2 gap-2">
                    <Tile
                        label={t("analytics.expectedCash")}
                        value={formatMoney(day.expectedCash)}
                        tone="bg-purple-100 text-purple-900"
                    />
                    <Tile
                        label={t("analytics.actualCash")}
                        value={day.actualCash === null ? "—" : formatMoney(day.actualCash)}
                        tone="bg-amber-100 text-amber-900"
                    />
                </div>
                {day.variance !== null && (
                    <Tile
                        label={t("analytics.variance")}
                        value={`${day.variance >= 0 ? "+" : ""}${formatMoney(day.variance)}`}
                        tone={
                            day.variance >= 0
                                ? "bg-green-100 text-green-900"
                                : "bg-red-100 text-red-900"
                        }
                    />
                )}
            </div>

            {day.expenseItems.length > 0 && (
                <Section title={t("daily.expenses")}>
                    <div className="bg-red-100 p-2 rounded-xl space-y-1">
                        {day.expenseItems.map((e) => (
                            <div key={e.id} className="flex justify-between text-sm">
                                <span className="text-red-800">{e.type}</span>
                                <span className="font-bold text-red-800">
                                    -{formatMoney(e.amount)}
                                </span>
                            </div>
                        ))}
                        <div className="border-t border-red-300 pt-1 flex justify-between text-sm font-semibold text-red-800">
                            <span>{t("analytics.total")}</span>
                            <span>-{formatMoney(day.expenses)}</span>
                        </div>
                    </div>
                </Section>
            )}

            {day.sellers.length > 0 && (
                <Section title={t("daily.whoWorked")}>
                    <Sellers sellers={day.sellers} />
                </Section>
            )}

            {day.notes && (
                <Section title={t("analytics.notes")}>
                    <p className="text-sm text-gray-700 bg-slate-100 p-2.5 rounded-xl">
                        {day.notes}
                    </p>
                </Section>
            )}

            {(opening || closing.length > 0) && (
                <Section title={t("daily.photos")}>
                    {opening && (
                        <PhotoGroup title={t("daily.photoOpening")}>
                            <PhotoTile photo={opening} label={t("daily.photoOpening")} />
                        </PhotoGroup>
                    )}
                    {closing.length > 0 && (
                        <PhotoGroup title={t("daily.photoClosing")}>
                            {closing.map((p) => (
                                <PhotoTile
                                    key={p.type}
                                    photo={p}
                                    label={t(`store.photo.${p.type.slice(8)}` as MessageKey)}
                                />
                            ))}
                        </PhotoGroup>
                    )}
                </Section>
            )}

            <Section title={t("daily.breakdown")}>
                {day.products.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">
                        {t("daily.noBreakdown")}
                    </p>
                ) : (
                    <div className="grid grid-cols-2 gap-2">
                        {day.products.map((p) => (
                            <div key={p.name} className="bg-slate-100 p-2.5 rounded-xl">
                                <p className="font-semibold text-gray-800 text-sm truncate">
                                    {p.name || t("common.unknown")}
                                </p>
                                <p className="font-bold text-gray-800">
                                    {p.quantity} {t("analytics.cups")}
                                </p>
                                <p className="text-sm text-gray-500">{formatMoney(p.revenue)}</p>
                            </div>
                        ))}
                    </div>
                )}
            </Section>
        </div>
    );
}

function Tile({
    label,
    value,
    tone,
    className = "",
}: {
    label: string;
    value: string;
    tone: string;
    className?: string;
}) {
    const [bg, text] = tone.split(" ");
    return (
        <div className={`${bg} p-2 rounded-lg ${className}`}>
            <p className="text-xs font-semibold text-gray-700">{label}</p>
            <p className={`text-xl font-bold ${text}`}>{value}</p>
        </div>
    );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <div className="bg-white rounded-2xl p-3 space-y-2">
            <h4 className="text-sm font-semibold text-gray-800">{title}</h4>
            {children}
        </div>
    );
}

function PhotoGroup({ title, children }: { title: string; children: ReactNode }) {
    return (
        <div className="space-y-1.5 pb-2">
            <SectionLabel inset={false}>{title}</SectionLabel>
            <div className="grid grid-cols-2 gap-2">{children}</div>
        </div>
    );
}

/** A day photo; a tap opens it full screen. Its address is signed for a few minutes. */
export function PhotoTile({ photo, label }: { photo: Photo; label: string }) {
    const [open, setOpen] = useState(false);
    const [broken, setBroken] = useState(!photo.url);
    return (
        <div className="bg-slate-50 rounded-xl overflow-hidden">
            <button
                onClick={() => !broken && setOpen(true)}
                className="block w-full aspect-square bg-gray-100"
            >
                {broken ? (
                    <ImageOff className="m-auto text-gray-400" />
                ) : (
                    <img
                        src={photo.url}
                        alt={label}
                        loading="lazy"
                        onError={() => setBroken(true)}
                        className="size-full object-cover"
                    />
                )}
            </button>
            <div className="p-2">
                <p className="text-xs font-semibold text-gray-800">{label}</p>
                {photo.quantity && (
                    <p className="text-xs text-gray-500">
                        {photo.quantity.value} {photo.quantity.unit}
                    </p>
                )}
            </div>
            <Dialog open={open} onClose={() => setOpen(false)} dim="bg-black/90" label={label}>
                <img
                    src={photo.url}
                    alt={label}
                    className="max-h-[90dvh] max-w-full object-contain"
                />
                <button
                    onClick={() => setOpen(false)}
                    className="fixed top-4 right-4 p-2 text-white"
                    aria-label={label}
                >
                    <X size={28} />
                </button>
            </Dialog>
        </div>
    );
}
