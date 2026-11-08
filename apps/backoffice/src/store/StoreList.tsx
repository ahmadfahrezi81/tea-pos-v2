import type { components } from "@tea-pos/api-client";
import { formatDateTime, formatMoney, formatTime, localDate } from "@tea-pos/format";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { rowIcon, SettingsGroup, SettingsRow } from "@tea-pos/shell/Settings";
import { useSlug } from "@tea-pos/shell/tenant";
import { Badge } from "@tea-pos/ui/Badge";
import { EmptyState } from "@tea-pos/ui/EmptyState";
import { ListSection } from "@tea-pos/ui/ListSection";
import { ListCard, ListRow } from "@tea-pos/ui/ListRow";
import { SectionLabel } from "@tea-pos/ui/SectionLabel";
import { Skeleton } from "@tea-pos/ui/Skeleton";
import { Tile } from "@tea-pos/ui/Tile";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChartNoAxesCombined, CircleHelp, ReceiptText, Settings } from "lucide-react";

import { RangeBar, useRange } from "./range";
import { RangePanel } from "./RangePanel";
import { ALL, dayCash, plain, useLatestOrders, useScopeStores } from "./sales";
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
                <ListSection title={t("store.stores")} count={shown.length} framed>
                    {shown.map((s) => (
                        <StoreCard key={s.id} store={s} slug={slug} />
                    ))}
                </ListSection>
            )}

            <LatestOrders />

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

export function useStatus() {
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
            <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 text-lg font-bold text-gray-900 truncate">{s.name}</p>
                <span className="shrink-0">
                    <StatusPill {...pill} />
                </span>
            </div>
            {/* Analytics' cash summary, condensed: two rows of three, short words. */}
            <div className="grid grid-cols-3 gap-1.5">
                {single ? (
                    <>
                        {/* Row by row: Opening, Revenue (opening + sales), Expected; + Sales, − Expenses, Actual; the cash summary's colours. */}
                        <Tile
                            label={t("store.opening")}
                            value={plain(s.opening)}
                            className="bg-blue-100"
                            color="text-blue-900"
                        />
                        <Tile
                            label={t("store.revenue")}
                            value={plain(s.opening + s.sales)}
                            className="bg-blue-100"
                            color="text-blue-900"
                        />
                        <Tile
                            label={t("store.expected")}
                            value={plain(dayCash(s, true))}
                            className="bg-purple-100"
                            color="text-purple-900"
                        />
                        <Tile
                            label={`+ ${t("store.salesShort")}`}
                            value={plain(s.sales)}
                            className="bg-green-100"
                            color="text-green-900"
                        />
                        <Tile
                            label={`− ${t("store.expenses")}`}
                            value={plain(s.expenses)}
                            className="bg-red-100"
                            color="text-red-900"
                        />
                        <Tile
                            label={t("store.actual")}
                            value={s.closedDays > 0 ? plain(s.cashCounted) : "—"}
                            className="bg-amber-100"
                            color="text-amber-900"
                        />
                    </>
                ) : (
                    <>
                        <Tile
                            label={t("store.salesShort")}
                            value={plain(s.sales)}
                            className="bg-green-100"
                            color="text-green-900"
                        />
                        <Tile
                            label={t("store.expenses")}
                            value={plain(s.expenses)}
                            className="bg-red-100"
                            color="text-red-900"
                        />
                        <Tile
                            label={t("store.net")}
                            value={plain(s.sales - s.expenses)}
                            className="bg-blue-100"
                            color="text-blue-900"
                        />
                        <Tile
                            label={t("store.cups")}
                            value={String(s.cups)}
                            className="bg-orange-100"
                            color="text-orange-900"
                        />
                        <Tile
                            label={t("store.perDay")}
                            value={s.days > 0 ? plain(Math.round(s.sales / s.days)) : "—"}
                            className="bg-slate-100"
                        />
                        <Tile
                            label={t("store.cashOff")}
                            value={offBy(s.cashDiff)}
                            className={s.cashDiff === 0 ? "bg-slate-100" : "bg-red-100"}
                            color={s.cashDiff === 0 ? "text-gray-900" : "text-red-900"}
                        />
                    </>
                )}
            </div>
            {s.sellers.length > 0 && <Sellers sellers={s.sellers} />}
            {/* One day closed with its cash off: the difference as a bar, as the day's cash summary. */}
            {single && s.closedDays > 0 && s.cashDiff !== 0 && (
                <div className="space-y-1">
                    <p className="px-1 text-sm font-semibold text-gray-900">
                        {t("store.cashVariance")}
                    </p>
                    <p
                        className={`rounded-xl px-3 py-2 text-base font-bold ${s.cashDiff > 0 ? "bg-green-100 text-green-900" : "bg-red-100 text-red-900"}`}
                    >
                        {s.cashDiff > 0 ? "+" : "−"}
                        {formatMoney(Math.abs(s.cashDiff))}
                    </p>
                </div>
            )}
        </Link>
    );
}

const offBy = (diff: number) =>
    diff === 0 ? "+0" : `${diff < 0 ? "−" : "+"}${plain(Math.abs(diff))}`;

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

/** The newest orders across the stores, as they come in (live, and every minute today). */
function LatestOrders() {
    const t = useT();
    const locale = useLocale();
    const slug = useSlug();
    const { from, to, single } = useRange();
    const orders = useLatestOrders(from, to);
    const navigate = useNavigate();
    // A row opens the same list as See all.
    const all = () =>
        navigate({
            to: "/$tenant/store/$storeId/orders",
            params: { tenant: slug, storeId: ALL },
            search: { from, to },
        });
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <SectionLabel>{t("store.latestOrders")}</SectionLabel>
                <Link
                    to="/$tenant/store/$storeId/orders"
                    params={{ tenant: slug, storeId: ALL }}
                    search={{ from, to }}
                    className="px-1 text-sm font-semibold text-brand active:opacity-70"
                >
                    {t("store.seeAll")} ›
                </Link>
            </div>
            {orders.isPending ? (
                <Skeleton className="h-40 rounded-2xl" />
            ) : (
                // A thin grey frame around the list, as the store page had it.
                <div className="rounded-2xl bg-slate-200/70 p-1">
                    <ListCard>
                        {(orders.data?.items ?? []).length === 0 ? (
                            <p className="py-4 text-gray-900">{t("store.noSales")}</p>
                        ) : (
                            (orders.data?.items ?? []).map((o) => (
                                <ListRow
                                    key={o.id}
                                    onClick={all}
                                    title={
                                        <span className="text-[15px]">
                                            {single
                                                ? formatTime(o.at, locale)
                                                : formatDateTime(o.at, locale)}
                                            {` · ${o.cups} ${t("store.cupsUnit")}`}
                                        </span>
                                    }
                                    subtitle={[o.storeName, o.seller].filter(Boolean).join(" · ")}
                                    trailing={
                                        <span className="font-bold text-gray-900">
                                            {formatMoney(o.total)}
                                        </span>
                                    }
                                />
                            ))
                        )}
                    </ListCard>
                </div>
            )}
        </div>
    );
}
