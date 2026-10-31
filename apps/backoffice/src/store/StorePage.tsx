import { formatDateTime, formatMoney, formatTime } from "@tea-pos/format";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { HeaderTitle } from "@tea-pos/shell/HeaderActions";
import { rowIcon, SettingsGroup, SettingsRow } from "@tea-pos/shell/Settings";
import { useSlug } from "@tea-pos/shell/tenant";
import { Avatar } from "@tea-pos/ui/Avatar";
import { ListCard, ListRow } from "@tea-pos/ui/ListRow";
import { SectionLabel } from "@tea-pos/ui/SectionLabel";
import { Skeleton } from "@tea-pos/ui/Skeleton";
import { Link } from "@tanstack/react-router";
import { ChartNoAxesCombined } from "lucide-react";

import { RangeBar, useRange } from "./range";
import { RangePanel } from "./RangePanel";
import { useDays, useLatestOrders, useScopeStores, useStoreId } from "./sales";
import { Sellers } from "./Sellers";
import { closedLine, OpenBadge } from "./StoreList";

/**
 * One store over the range: who is on (today), the numbers, the latest orders coming in, then
 * Day by day. Everyday information is here; Orders and Day by day are for going further.
 */
export function StorePage() {
    const t = useT();
    const locale = useLocale();
    const slug = useSlug();
    const storeId = useStoreId();
    const { from, to, single, isToday } = useRange();
    const { stores, totals } = useScopeStores(from, to);
    const store = stores?.[0];
    const orders = useLatestOrders(from, to);
    // Only one day needs them here, to go straight to its detail; a range's list loads when opened.
    const days = useDays(from, to, single);
    const search = { from, to };
    // One day of one store: straight to its detail, there is no list to scroll.
    const onlyDay = single && days.data?.days.length === 1 ? days.data.days[0] : undefined;

    return (
        <div className="flex flex-col gap-3">
            <HeaderTitle>{store?.name ?? ""}</HeaderTitle>
            <RangeBar />

            {store && isToday && (
                <div className="rounded-2xl bg-white p-4 flex items-center gap-3">
                    {store.open ? (
                        <>
                            <Avatar url={store.sellerAvatar} size={40} />
                            <div className="flex-1 min-w-0">
                                <p className="truncate font-semibold text-gray-900">
                                    {t("store.isSelling").replace("{name}", store.sellerName ?? "")}
                                </p>
                                {store.openSince && (
                                    <p className="text-sm text-gray-900">
                                        {t("store.openSince").replace(
                                            "{time}",
                                            formatTime(store.openSince, locale),
                                        )}
                                    </p>
                                )}
                            </div>
                        </>
                    ) : (
                        <p className="flex-1 text-gray-900">{closedLine(store, t, locale)}</p>
                    )}
                    <OpenBadge store={store} />
                </div>
            )}

            <RangePanel totals={totals} />

            {store && !isToday && store.sellers.length > 0 && (
                <div className="rounded-2xl bg-white p-3">
                    <Sellers sellers={store.sellers} />
                </div>
            )}

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <SectionLabel>{t("store.latestOrders")}</SectionLabel>
                    <Link
                        to="/$tenant/store/$storeId/orders"
                        params={{ tenant: slug, storeId }}
                        search={search}
                        className="px-1 text-sm font-semibold text-brand active:opacity-70"
                    >
                        {t("store.seeAll")} ›
                    </Link>
                </div>
                {orders.isPending ? (
                    <Skeleton className="h-40 rounded-2xl" />
                ) : (
                    <ListCard>
                        {(orders.data?.items ?? []).length === 0 ? (
                            <p className="py-4 text-gray-900">{t("store.noSales")}</p>
                        ) : (
                            (orders.data?.items ?? []).map((o) => (
                                <ListRow
                                    key={o.id}
                                    title={
                                        single
                                            ? formatTime(o.at, locale)
                                            : formatDateTime(o.at, locale)
                                    }
                                    subtitle={`${o.cups} ${t("store.cupsUnit")}${o.seller ? ` · ${o.seller}` : ""}`}
                                    trailing={
                                        <span className="font-bold text-gray-900">
                                            {formatMoney(o.total)}
                                        </span>
                                    }
                                />
                            ))
                        )}
                    </ListCard>
                )}
            </div>

            <SettingsGroup>
                <SettingsRow
                    to={
                        onlyDay
                            ? `/${slug}/store/${storeId}/analytics/days/${onlyDay.id}`
                            : `/${slug}/store/${storeId}/analytics`
                    }
                    search={onlyDay ? undefined : search}
                    icon={<ChartNoAxesCombined {...rowIcon} />}
                    label={t(single ? "store.dayDetail" : "store.dayByDay")}
                />
            </SettingsGroup>
        </div>
    );
}
