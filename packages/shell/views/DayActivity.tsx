import { ArrowRightLeft } from "lucide-react";
import { $api } from "@tea-pos/api-client";
import { STALE } from "@tea-pos/api-client/query";
import { useSlug } from "../session/tenant";
import type { components } from "@tea-pos/api-client";
import { formatMoney, formatTime } from "@tea-pos/format";
import type { MessageKey } from "@tea-pos/i18n";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { Avatar } from "@tea-pos/ui/Avatar";
import type { ReactNode } from "react";

import { EVENT } from "./dayEvents";
import { PhotoTile } from "./DayView";
import { Skeleton } from "@tea-pos/ui/Skeleton";
import { EmptyState } from "@tea-pos/ui/EmptyState";
import { Badge } from "@tea-pos/ui/Badge";

function useDayActivity(id: string) {
    const tenant = useSlug();
    return $api.useQuery(
        "get",
        "/tenants/{tenant}/days/{id}/activity",
        { params: { path: { tenant, id } } },
        { enabled: !!tenant && !!id, staleTime: STALE.COOL },
    );
}

function useDaySessions(id: string) {
    const tenant = useSlug();
    return $api.useQuery(
        "get",
        "/tenants/{tenant}/days/{id}/sessions",
        { params: { path: { tenant, id } } },
        { enabled: !!tenant && !!id, staleTime: STALE.COOL },
    );
}

type Event = components["schemas"]["DayEvent"];
type Session = components["schemas"]["DaySession"];

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
                    {method && <Badge>{method}</Badge>}
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

const spent = (start: string, end: string | undefined) =>
    (end ? Date.parse(end) : Date.now()) - Date.parse(start);

function hours(ms: number): string {
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    if (h === 0) return `${m}m`;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/**
 * Who worked the day, in one card: each person with their cups, and under them their sessions
 * (from, to, who they took over from, how long).
 */
export function DayPeople({
    id,
    sellers,
}: {
    id: string;
    sellers: components["schemas"]["DaySeller"][];
}) {
    const t = useT();
    const locale = useLocale();
    const { data } = useDaySessions(id);
    if (!data) return <Skeleton className="h-24 rounded-xl" />;
    const sessions = data.sessions;
    const nameOf = new Map(sessions.map((s) => [s.id, s.userName]));
    // Everyone who sold or held the store, in the order they first started.
    const people = new Map<string, { name: string; avatarUrl?: string; cups: number }>();
    for (const s of sessions)
        if (!people.has(s.userId))
            people.set(s.userId, { name: s.userName ?? "", avatarUrl: s.avatarUrl, cups: 0 });
    for (const s of sellers)
        people.set(s.userId, { name: s.name, avatarUrl: s.avatarUrl, cups: s.cups });
    if (people.size === 0) return <EmptyState title={t("daily.noSessions")} />;
    return (
        <div className="flex flex-col gap-1.5">
            {[...people].map(([userId, p]) => {
                const own = sessions.filter((s) => s.userId === userId);
                return (
                    <div key={userId} className="bg-slate-100 rounded-xl p-2 space-y-1.5">
                        <div className="flex items-center gap-2">
                            <Avatar url={p.avatarUrl} size={28} />
                            <p className="text-base font-bold text-gray-900 truncate flex-1">
                                {p.name || t("common.unknown")}
                            </p>
                            <span className="text-sm font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-lg shrink-0">
                                {p.cups} {t("store.cupsUnit")}
                            </span>
                        </div>
                        {own.map((s: Session) => (
                            <div
                                key={s.id}
                                className="flex items-center gap-2 pl-9 text-sm text-gray-800"
                            >
                                <span className="font-semibold">
                                    {formatTime(s.startedAt, locale)}
                                    <span className="text-gray-400 mx-1.5">→</span>
                                    {s.endedAt
                                        ? formatTime(s.endedAt, locale)
                                        : t("daily.sessionNow")}
                                </span>
                                {s.status === "active" && (
                                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-800">
                                        {t("daily.sessionActive")}
                                    </span>
                                )}
                                {s.previousSessionId && (
                                    <span className="flex items-center gap-1 text-xs text-gray-500 truncate">
                                        <ArrowRightLeft size={12} className="shrink-0" />
                                        {nameOf.get(s.previousSessionId) ?? ""}
                                    </span>
                                )}
                                <span className="ml-auto text-sm font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-lg shrink-0">
                                    {hours(spent(s.startedAt, s.endedAt))}
                                </span>
                            </div>
                        ))}
                    </div>
                );
            })}
        </div>
    );
}
