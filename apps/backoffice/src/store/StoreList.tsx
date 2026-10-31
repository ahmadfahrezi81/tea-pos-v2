import type { components } from "@tea-pos/api-client";
import { formatDay, formatMoney, formatTime, localDate } from "@tea-pos/format";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { rowIcon, SettingsGroup, SettingsRow } from "@tea-pos/shell/Settings";
import { useSlug } from "@tea-pos/shell/tenant";
import { Badge } from "@tea-pos/ui/Badge";
import { EmptyState } from "@tea-pos/ui/EmptyState";
import { ListSection } from "@tea-pos/ui/ListSection";
import { Skeleton } from "@tea-pos/ui/Skeleton";
import { Tile } from "@tea-pos/ui/Tile";
import { Link } from "@tanstack/react-router";
import { ChartNoAxesCombined, CircleHelp, ReceiptText } from "lucide-react";

import { RangeBar, useRange } from "./range";
import { RangePanel } from "./RangePanel";
import { ALL, useScopeStores } from "./sales";
import { Sellers } from "./Sellers";

type Store = components["schemas"]["StoreLive"];

/**
 * The Store tab's home: how the business did in the range, real stores only, then each store
 * with its numbers before any tap, and the range's orders and days over all of them.
 */
export function StoreList() {
    const t = useT();
    const slug = useSlug();
    const { from, to, isToday } = useRange();
    const { stores, totals } = useScopeStores(from, to);
    // Today shows who is open first (the API's order); a past range, who sold most.
    const shown = isToday ? stores : stores && [...stores].sort((a, b) => b.sales - a.sales);
    const search = { from, to };

    return (
        <div className="flex flex-col gap-3">
            <RangeBar />
            <RangePanel totals={totals} />

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
            <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-lg font-bold text-gray-900 truncate">{s.name}</p>
                    <StatusPill {...pill} />
                </div>
                <div className="shrink-0 space-y-1 text-right">
                    <p className="text-xs font-semibold text-gray-900">
                        {t(!single ? "store.salesShort" : open ? "store.expected" : "store.total")}
                    </p>
                    <p className="font-bold text-green-600">
                        {!single
                            ? formatMoney(s.sales)
                            : open
                              ? formatMoney(s.opening + s.sales - s.expenses)
                              : s.closedDays > 0
                                ? formatMoney(s.cashCounted)
                                : "—"}
                    </p>
                </div>
            </div>
            {single ? (
                <div className="grid grid-cols-3 gap-1.5">
                    <Tile
                        label={t("store.opening")}
                        value={plain(s.opening)}
                        className="bg-slate-100"
                    />
                    <Tile
                        label={`+ ${t("store.salesShort")}`}
                        value={plain(s.sales)}
                        className="bg-blue-100"
                    />
                    <Tile
                        label={`− ${t("store.expenses")}`}
                        value={plain(s.expenses)}
                        className="bg-purple-100"
                    />
                </div>
            ) : (
                <div className="grid grid-cols-3 gap-1.5">
                    <Tile
                        label={t("store.cups")}
                        value={String(s.cups)}
                        className="bg-orange-100"
                    />
                    <Tile
                        label={t("store.expenses")}
                        value={plain(s.expenses)}
                        className="bg-purple-100"
                    />
                    <Tile
                        label={t("store.cashOff")}
                        value={
                            s.cashDiff === 0
                                ? "0"
                                : `${s.cashDiff < 0 ? "−" : "+"}${plain(Math.abs(s.cashDiff))}`
                        }
                        className={s.cashDiff === 0 ? "bg-green-100" : "bg-red-100"}
                    />
                </div>
            )}
            {s.sellers.length > 0 && <Sellers sellers={s.sellers} />}
            {single && s.cashDiff !== 0 && (
                <p className="rounded-xl bg-red-100 px-3 py-1.5 text-sm font-bold text-red-700">
                    {t(s.cashDiff < 0 ? "store.cashShort" : "store.cashOver").replace(
                        "{amount}",
                        formatMoney(Math.abs(s.cashDiff)),
                    )}
                </p>
            )}
        </Link>
    );
}

const plain = (amount: number) => formatMoney(amount).replace(/^Rp\s*/, "");

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
