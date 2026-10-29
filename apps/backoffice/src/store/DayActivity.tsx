import type { components } from "@tea-pos/api-client";
import { formatMoney, formatTime } from "@tea-pos/format";
import type { MessageKey } from "@tea-pos/i18n";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { Avatar } from "@tea-pos/ui/Avatar";
import {
    AlertTriangle,
    ArrowRightLeft,
    DollarSign,
    Hash,
    Image,
    Lock,
    LockOpen,
    LogOut,
    Package,
    ShoppingCart,
    Trash2,
    Wallet,
    type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { PhotoTile } from "./DayDetail";
import { useDayActivity, useDaySessions } from "./sales";
import { Skeleton } from "@tea-pos/ui/Skeleton";
import { EmptyState } from "@tea-pos/ui/EmptyState";

type Event = components["schemas"]["DayEvent"];
type Session = components["schemas"]["DaySession"];

const EVENT: Record<string, { icon: LucideIcon; color: string }> = {
    order_created: { icon: ShoppingCart, color: "bg-blue-500" },
    store_opened: { icon: LockOpen, color: "bg-green-500" },
    store_closed: { icon: Lock, color: "bg-gray-500" },
    session_transferred: { icon: ArrowRightLeft, color: "bg-blue-500" },
    session_ended: { icon: LogOut, color: "bg-slate-400" },
    expense_created: { icon: DollarSign, color: "bg-orange-400" },
    expense_updated: { icon: DollarSign, color: "bg-orange-400" },
    expense_deleted: { icon: Trash2, color: "bg-red-400" },
    opening_balance_updated: { icon: Wallet, color: "bg-blue-400" },
    summary_photo_uploaded: { icon: Image, color: "bg-teal-400" },
    summary_photo_deleted: { icon: Trash2, color: "bg-red-400" },
    summary_photo_updated: { icon: Hash, color: "bg-teal-400" },
    supply_request_created: { icon: Package, color: "bg-purple-500" },
    incident_report_created: { icon: AlertTriangle, color: "bg-red-500" },
};

const num = (m: Record<string, unknown>, key: string) =>
    typeof m[key] === "number" ? (m[key] as number) : null;
const str = (m: Record<string, unknown>, key: string) =>
    typeof m[key] === "string" ? (m[key] as string) : null;

function Row({
    indicator,
    last,
    children,
}: {
    indicator: ReactNode;
    last: boolean;
    children: ReactNode;
}) {
    return (
        <div className="grid grid-cols-[2rem_1fr] gap-x-3">
            <div className="flex flex-col items-center pt-0.5">
                {indicator}
                {!last && (
                    <div className="w-px flex-1 border-l-2 border-dashed border-gray-200 mt-1" />
                )}
            </div>
            <div>{children}</div>
        </div>
    );
}

/** What happened during a store's day, oldest first: orders as small rows, the rest as cards. */
export function DayActivity({ id }: { id: string }) {
    const t = useT();
    const { data } = useDayActivity(id);
    if (!data) return <Skeleton className="h-64 rounded-2xl" />;
    const events = data.events;
    if (events.length === 0) return <EmptyState title={t("daily.noActivity")} />;
    return (
        <div className="bg-white rounded-2xl p-3">
            {events.map((e, i) =>
                e.type === "order_created" ? (
                    <OrderRow key={e.id} event={e} last={i === events.length - 1} />
                ) : (
                    <EventCard key={e.id} event={e} last={i === events.length - 1} />
                ),
            )}
        </div>
    );
}

function OrderRow({ event, last }: { event: Event; last: boolean }) {
    const t = useT();
    const locale = useLocale();
    const m = event.metadata as Record<string, unknown>;
    const amount = num(m, "total_amount");
    const cups = num(m, "total_cups");
    const method = str(m, "payment_method");
    return (
        <Row
            last={last}
            indicator={
                <div className="size-8 flex items-center justify-center shrink-0">
                    <div className="size-2.5 rounded-full bg-blue-400" />
                </div>
            }
        >
            <div className="flex items-center justify-between py-2 gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                    {amount !== null && (
                        <span className="text-sm font-bold text-gray-800">
                            {formatMoney(amount)}
                        </span>
                    )}
                    {cups !== null && (
                        <span className="text-xs text-gray-400">
                            {cups} {t("orders.cups")}
                        </span>
                    )}
                    {method && (
                        <span className="text-xs bg-slate-100 text-gray-500 px-1.5 py-0.5 rounded-md capitalize">
                            {method}
                        </span>
                    )}
                </div>
                <span className="text-xs text-gray-400 shrink-0">
                    {formatTime(event.at, locale)}
                </span>
            </div>
        </Row>
    );
}

function EventCard({ event, last }: { event: Event; last: boolean }) {
    const t = useT();
    const locale = useLocale();
    const m = event.metadata as Record<string, unknown>;
    const look = EVENT[event.type];
    const Icon = look?.icon;
    const label = t(`store.event.${event.type}` as MessageKey);
    const pairs: [string, string, string][] = [];
    const opening = num(m, "opening_balance");
    const sales = num(m, "total_sales");
    const variance = num(m, "variance");
    if (opening !== null)
        pairs.push([t("analytics.openingBalance"), formatMoney(opening), "text-blue-600"]);
    if (sales !== null)
        pairs.push([t("analytics.totalSales"), formatMoney(sales), "text-green-600"]);
    if (variance !== null)
        pairs.push([
            t("analytics.variance"),
            `${variance >= 0 ? "+" : ""}${formatMoney(variance)}`,
            variance >= 0 ? "text-green-600" : "text-red-500",
        ]);
    const amount = num(m, "amount");
    const kind = str(m, "type");
    const photo = str(m, "photo_url");
    const slot = str(m, "slot");
    const qty = m.quantity as { value?: number; unit?: string } | null | undefined;
    const slotLabel = slot ? t(`store.photo.${slot.replace("closing:", "")}` as MessageKey) : "";

    return (
        <Row
            last={last}
            indicator={
                <div
                    className={`size-8 rounded-xl flex items-center justify-center shrink-0 ${look?.color ?? "bg-gray-400"}`}
                >
                    {Icon && <Icon size={16} strokeWidth={2.5} className="text-white" />}
                </div>
            }
        >
            <div className="mb-3 space-y-2">
                <div className="flex items-center justify-between gap-2 pt-1">
                    <p className="font-semibold text-gray-800 text-sm">{label}</p>
                    <span className="text-xs text-gray-400 shrink-0">
                        {formatTime(event.at, locale)}
                    </span>
                </div>
                {event.userName && <p className="text-xs text-gray-500">{event.userName}</p>}
                {(amount !== null || kind) && (
                    <div className="bg-slate-100 rounded-xl px-3 py-2 flex items-center justify-between">
                        {kind && <span className="text-sm text-gray-600">{kind}</span>}
                        {amount !== null && (
                            <span className="text-sm font-bold text-orange-600">
                                {formatMoney(amount)}
                            </span>
                        )}
                    </div>
                )}
                {pairs.map(([k, v, color]) => (
                    <div
                        key={k}
                        className="bg-slate-100 rounded-xl px-3 py-2 flex items-center justify-between"
                    >
                        <span className="text-xs text-gray-500">{k}</span>
                        <span className={`text-sm font-bold ${color}`}>{v}</span>
                    </div>
                ))}
                {photo !== null && (
                    <div className="w-24">
                        <PhotoTile photo={{ type: slot ?? "", url: photo }} label={slotLabel} />
                    </div>
                )}
                {qty && typeof qty.value === "number" && slot && (
                    <div className="bg-slate-100 rounded-xl px-3 py-2 flex items-center justify-between">
                        <span className="text-sm text-gray-600">{slotLabel}</span>
                        <span className="text-sm font-bold text-gray-800">
                            {qty.value} {qty.unit}
                        </span>
                    </div>
                )}
            </div>
        </Row>
    );
}

function duration(start: string, end: string | undefined): string {
    const ms = (end ? Date.parse(end) : Date.now()) - Date.parse(start);
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    if (h === 0) return `${m}m`;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Who held the store that day, in order, and who took over from whom. */
export function DaySessions({ id }: { id: string }) {
    const t = useT();
    const locale = useLocale();
    const { data } = useDaySessions(id);
    if (!data) return <Skeleton className="h-40 rounded-2xl" />;
    const sessions = data.sessions;
    if (sessions.length === 0) return <EmptyState title={t("daily.noSessions")} />;
    const people = new Set(sessions.map((s) => s.userId)).size;
    const nameOf = new Map(sessions.map((s) => [s.id, s.userName]));
    return (
        <div className="flex flex-col gap-3">
            <div className="bg-white rounded-2xl px-4 py-3 flex items-center gap-4 text-sm">
                <div>
                    <span className="font-bold text-gray-900">{sessions.length}</span>
                    <span className="text-gray-500 ml-1">
                        {t(sessions.length === 1 ? "daily.session" : "daily.sessions")}
                    </span>
                </div>
                <div className="w-px h-4 bg-gray-200" />
                <div>
                    <span className="font-bold text-gray-900">{people}</span>
                    <span className="text-gray-500 ml-1">
                        {t(people === 1 ? "daily.person" : "daily.people")}
                    </span>
                </div>
            </div>
            {sessions.map((s: Session) => (
                <div key={s.id} className="bg-white rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <Avatar url={s.avatarUrl} size={36} square />
                            <p className="font-bold text-gray-900">
                                {s.userName || t("common.unknown")}
                            </p>
                        </div>
                        <span
                            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                                s.status === "active"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-gray-100 text-gray-600"
                            }`}
                        >
                            {t(
                                s.status === "active"
                                    ? "daily.sessionActive"
                                    : "daily.sessionEnded",
                            )}
                        </span>
                    </div>
                    <div className="bg-slate-100 rounded-xl px-3 py-2.5 flex items-center justify-between">
                        <div className="text-sm">
                            <span className="font-semibold text-gray-800">
                                {formatTime(s.startedAt, locale)}
                            </span>
                            <span className="text-gray-400 mx-1.5">→</span>
                            <span className="font-semibold text-gray-800">
                                {s.endedAt ? formatTime(s.endedAt, locale) : t("daily.sessionNow")}
                            </span>
                        </div>
                        <span className="text-sm font-bold text-brand">
                            {duration(s.startedAt, s.endedAt)}
                        </span>
                    </div>
                    {s.previousSessionId && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <ArrowRightLeft size={12} className="shrink-0" />
                            <span>
                                {t("daily.takenOver")}{" "}
                                <span className="font-semibold text-gray-700">
                                    {nameOf.get(s.previousSessionId) ?? ""}
                                </span>
                            </span>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
