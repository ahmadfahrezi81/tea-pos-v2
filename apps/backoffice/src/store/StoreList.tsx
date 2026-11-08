import type { components } from "@tea-pos/api-client";
import { formatDay, formatTime, localDate } from "@tea-pos/format";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { rowIcon, SettingsGroup, SettingsRow } from "@tea-pos/shell/Settings";
import { useSlug } from "@tea-pos/shell/tenant";
import { Badge } from "@tea-pos/ui/Badge";
import { EmptyState } from "@tea-pos/ui/EmptyState";
import { ListSection } from "@tea-pos/ui/ListSection";
import { Skeleton } from "@tea-pos/ui/Skeleton";
import { Tile } from "@tea-pos/ui/Tile";
import { Link } from "@tanstack/react-router";
import { ChartNoAxesCombined, CircleHelp, ReceiptText, Settings } from "lucide-react";

import { RangeBar, useRange } from "./range";
import { RangePanel } from "./RangePanel";
import { ALL, dayCash, plain, useScopeStores } from "./sales";
import { Sellers } from "@tea-pos/shell/Sellers";

type Store = components["schemas"]["StoreLive"];

/**
 * The Store tab's home: how the business did in the range, real stores only, then each store
 * with its numbers before any tap, and the range's orders and days over all of them.
 */
export function StoreList() {
    const t = useT();
    const slug = useSlug();
    const { from, to, isToday } = useRange();
    const { stores } = useScopeStores(from, to);
    // Today shows who is open first (the API's order); a past range, who sold most.
    const shown = isToday ? stores : stores && [...stores].sort((a, b) => b.sales - a.sales);
    const search = { from, to };

    return (
        <div className="flex flex-col gap-3">
            <RangeBar />
            <RangePanel stores={stores} />

            {!shown ? (
                Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} delay={i * 80} className="h-28 rounded-2xl" />
                ))
            ) : shown.length === 0 ? (
                <EmptyState title={t("store.noStores")} />
            ) : (
                <ListSection title={t("store.stores")} count={shown.length}>
                    {shown.map((s) => (
                        <StoreCard key={s.id} store={s} slug={slug} />
                    ))}
                </ListSection>
            )}

            <SettingsGroup>
                <SettingsRow
                    to={`/${slug}/store/${ALL}/orders`}
                    search={search}
                    icon={<ReceiptText {...rowIcon} />}
                    label={t("nav.orders")}
                />
                <SettingsRow
                    to={`/${slug}/store/${ALL}/analytics`}
                    search={search}
                    icon={<ChartNoAxesCombined {...rowIcon} />}
                    label={t("store.dayByDay")}
                />
                <SettingsRow
                    to={`/${slug}/store/settings`}
                    icon={<Settings {...rowIcon} />}
                    label={t("store.settingsTitle")}
                />
                <SettingsRow
                    to={`/${slug}/store/help`}
                    icon={<CircleHelp {...rowIcon} />}
                    label={t("store.helpTitle")}
                />
            </SettingsGroup>
        </div>
    );
}

function useStatus() {
    const t = useT();
    const locale = useLocale();
    return (
        s: Store,
        r: { single: boolean; isToday: boolean; open: boolean; today: boolean },
    ): { text: string; alert: boolean } => {
        const time = (at?: string | null) => (at ? formatTime(at, locale) : "");
        if (r.open)
            return {
                text: t("store.openAt").replace("{time}", time(s.openSince)),
                alert: false,
            };
        // Today's day is not late while the store is still selling.
        const unclosed = s.notClosed - (s.open && r.today ? 1 : 0);
        if (r.single) {
            if (s.days === 0)
                return { text: t(r.isToday ? "store.notOpened" : "store.didntOpen"), alert: false };
            if (unclosed > 0) return { text: t("store.notClosed"), alert: true };
            return {
                text: t("store.closedAtTime").replace("{time}", time(s.closedAt)),
                alert: false,
            };
        }
        if (s.days === 0) return { text: t("store.didntOpen"), alert: false };
        if (unclosed > 0)
            return { text: t("store.nNotClosed").replace("{n}", String(unclosed)), alert: true };
        return {
            text: t("store.daysClosed")
                .replace("{n}", String(s.days - s.notClosed))
                .replace("{m}", String(s.days)),
            alert: false,
        };
    };
}

function StoreCard({ store: s, slug }: { store: Store; slug: string }) {
    const t = useT();
    const { from, to, single, isToday } = useRange();
    const open = isToday && s.open;
    const pill = useStatus()(s, { single, isToday, open, today: to === localDate() });
    return (
        <Link
            to="/$tenant/store/$storeId"
            params={{ tenant: slug, storeId: s.id }}
            search={{ from, to }}
            className="block rounded-xl bg-white p-3 space-y-2.5 active:scale-[0.99]"
        >
            <div className="min-w-0">
                <p className="text-lg font-bold text-gray-900 truncate">{s.name}</p>
                <StatusPill {...pill} />
            </div>
            {/* Analytics' cash summary, condensed: two rows of three, short words. */}
            <div className="grid grid-cols-3 gap-1.5">
                {single ? (
                    <>
                        <Split
                            className="col-span-2 bg-blue-100"
                            left={{
                                label: t("store.opening"),
                                value: plain(s.opening),
                                color: "text-blue-900",
                            }}
                            right={{
                                label: t("store.salesShort"),
                                value: plain(s.sales),
                                color: "text-green-900",
                            }}
                        />
                        <OrdersCups orders={s.orders} cups={s.cups} />
                        <Tile
                            label={t("store.expenses")}
                            value={plain(s.expenses)}
                            className="bg-red-100"
                            color="text-red-900"
                        />
                        <Tile
                            label={t("store.expected")}
                            value={plain(dayCash(s, true))}
                            className="bg-purple-100"
                            color="text-purple-900"
                        />
                        <Counted store={s} withOff />
                    </>
                ) : (
                    <>
                        <Split
                            className="col-span-2 bg-green-100"
                            left={{
                                label: t("store.salesShort"),
                                value: plain(s.sales),
                                color: "text-green-900",
                            }}
                            right={{
                                label: t("store.expenses"),
                                value: plain(s.expenses),
                                color: "text-red-900",
                            }}
                        />
                        <OrdersCups orders={s.orders} cups={s.cups} />
                        <Tile
                            label={t("store.daysClosedLabel")}
                            value={`${s.days - s.notClosed}/${s.days}`}
                            className="bg-slate-100"
                        />
                        <Tile
                            label={t("store.cashOff")}
                            value={offBy(s.cashDiff)}
                            className={s.cashDiff === 0 ? "bg-green-100" : "bg-red-100"}
                            color={s.cashDiff === 0 ? "text-green-900" : "text-red-900"}
                        />
                        <Counted store={s} />
                    </>
                )}
            </div>
            {s.sellers.length > 0 && <Sellers sellers={s.sellers} />}
        </Link>
    );
}

type Half = { label: string; value: string; color: string };

/** Two figures in one tile, each with its own word, split down the middle. */
function Split({ left, right, className }: { left: Half; right: Half; className: string }) {
    const half = (h: Half) => (
        <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-900 truncate">{h.label}</p>
            <p className={`text-base font-bold truncate ${h.color}`}>{h.value}</p>
        </div>
    );
    return (
        <div className={`grid min-w-0 grid-cols-2 gap-2 rounded-lg p-2 ${className}`}>
            {half(left)}
            <div className="min-w-0 border-l border-black/10 pl-2">{half(right)}</div>
        </div>
    );
}

function OrdersCups({ orders, cups }: { orders: number; cups: number }) {
    const t = useT();
    return (
        <Split
            className="bg-violet-100"
            left={{ label: t("store.orders"), value: String(orders), color: "text-violet-900" }}
            right={{ label: t("store.cups"), value: String(cups), color: "text-orange-900" }}
        />
    );
}

const offBy = (diff: number) =>
    diff === 0 ? "+0" : `${diff < 0 ? "−" : "+"}${plain(Math.abs(diff))}`;

/** Cash counted at closing, and under it how far it was off: green when right, red when not. */
function Counted({ store: s, withOff = false }: { store: Store; withOff?: boolean }) {
    const t = useT();
    return (
        <div className="min-w-0 rounded-lg bg-amber-100 p-2">
            <p className="text-xs font-semibold text-gray-900 truncate">{t("store.counted")}</p>
            <p className="text-base font-bold truncate text-amber-900">
                {s.closedDays > 0 ? plain(s.cashCounted) : "—"}
            </p>
            {withOff && s.closedDays > 0 && (
                <p
                    className={`text-xs font-bold ${s.cashDiff === 0 ? "text-green-700" : "text-red-700"}`}
                >
                    {offBy(s.cashDiff)}
                </p>
            )}
        </div>
    );
}

/** The line under a store's name: did its day, or days, go as they should? */
function StatusPill({ text, alert }: { text: string; alert: boolean }) {
    return alert ? (
        <span className="inline-flex items-center rounded-sm bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-700">
            {text}
        </span>
    ) : (
        <Badge>{text}</Badge>
    );
}

/** Open or Closed, as a badge. */
export function OpenBadge({ store: s }: { store: Store }) {
    const t = useT();
    return <Badge>{t(s.open ? "store.open" : "store.closed")}</Badge>;
}

/** `Closed 21:04 yesterday`, or `Not opened yet`. */
export function closedLine(
    s: Store,
    t: ReturnType<typeof useT>,
    locale: ReturnType<typeof useLocale>,
): string {
    return s.lastClosed
        ? t("store.closedAt").replace(
              "{when}",
              `${formatTime(s.lastClosed, locale)} ${formatDay(s.lastClosed, locale).toLowerCase()}`,
          )
        : t("store.notOpened");
}
