import type { components } from "@tea-pos/api-client";
import { formatDay, formatMoney, formatTime } from "@tea-pos/format";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { rowIcon, SettingsGroup, SettingsRow } from "@tea-pos/shell/Settings";
import { useSlug } from "@tea-pos/shell/tenant";
import { Badge } from "@tea-pos/ui/Badge";
import { EmptyState } from "@tea-pos/ui/EmptyState";
import { ICON } from "@tea-pos/ui/icon";
import { Skeleton } from "@tea-pos/ui/Skeleton";
import { Link } from "@tanstack/react-router";
import { ChartNoAxesCombined, ChevronRight, CircleHelp, ReceiptText } from "lucide-react";

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
                shown.map((s) => <StoreCard key={s.id} store={s} slug={slug} live={isToday} />)
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

function StoreCard({ store: s, slug, live }: { store: Store; slug: string; live: boolean }) {
    const t = useT();
    const locale = useLocale();
    const { from, to } = useRange();
    return (
        <Link
            to="/$tenant/store/$storeId"
            params={{ tenant: slug, storeId: s.id }}
            search={{ from, to }}
            className="block rounded-2xl bg-white p-4 space-y-3 active:scale-[0.99]"
        >
            <div className="flex items-center justify-between gap-2">
                <p className="truncate text-lg font-bold text-gray-900">{s.name}</p>
                {live && <OpenBadge store={s} />}
            </div>
            {s.sellers.length > 0 ? (
                <Sellers sellers={s.sellers} />
            ) : (
                live && <p className="text-sm text-gray-900">{closedLine(s, t, locale)}</p>
            )}
            <div className="flex items-center justify-between border-t-2 border-slate-100 pt-2">
                <span className="text-base font-bold text-gray-900">
                    {formatMoney(s.sales)}
                    <span className="ml-2 text-sm font-medium">
                        {s.cups} {t("store.cupsUnit")}
                    </span>
                </span>
                <ChevronRight size={ICON} strokeWidth={2.5} className="text-brand/90" />
            </div>
        </Link>
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
