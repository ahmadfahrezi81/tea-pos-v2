import { formatMoney, formatTime, localDate } from "@tea-pos/format";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { HeaderTitle } from "@tea-pos/shell/HeaderActions";
import { rowIcon, SettingsGroup, SettingsRow } from "@tea-pos/shell/Settings";
import { useTenant } from "@tea-pos/shell/tenant";
import { AreaChart } from "@tea-pos/ui/AreaChart";
import { Avatar } from "@tea-pos/ui/Avatar";
import { ChartNoAxesCombined, ReceiptText } from "lucide-react";

import { OpenBadge } from "./StoreList";
import { ALL, useSalesHours, useStoreId, useStoresLive } from "./sales";
import { Skeleton } from "@tea-pos/ui/Skeleton";

const hourLabel = (h: number) => `${String(h).padStart(2, "0")}:00`;

/**
 * One store today (or every store together): who is on, sales so far and by hour, then its
 * Analytics and Orders. Open or closed and who is selling come from the list's own query.
 */
export function StorePage() {
    const t = useT();
    const locale = useLocale();
    const slug = useTenant()?.tenant.slug ?? "";
    const storeId = useStoreId();
    const live = useStoresLive();
    const hours = useSalesHours(localDate());
    const store = live.data?.stores.find((s) => s.id === storeId);
    const all = storeId === ALL;
    const totals = hours.data;

    return (
        <div className="flex flex-col gap-3">
            <HeaderTitle>{all ? t("shell.allStores") : (store?.name ?? "")}</HeaderTitle>

            {store && (
                <div className="rounded-2xl bg-white p-4">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-gray-600">
                            {store.open && store.openSince
                                ? t("store.openSince").replace(
                                      "{time}",
                                      formatTime(store.openSince, locale),
                                  )
                                : null}
                        </span>
                        <OpenBadge store={store} />
                    </div>
                    {store.open && (
                        <div className="mt-2 flex items-center gap-2 text-gray-900">
                            <Avatar url={store.sellerAvatar} size={28} />
                            <span className="truncate">
                                {t("store.isSelling").replace("{name}", store.sellerName ?? "")}
                            </span>
                        </div>
                    )}
                </div>
            )}

            <div className="rounded-2xl bg-white p-4">
                <p className="text-sm text-gray-500">{t("store.todayLabel")}</p>
                {totals ? (
                    <p className="mt-0.5 text-2xl font-bold text-gray-900">
                        {formatMoney(totals.sales)}
                    </p>
                ) : (
                    <Skeleton className="mt-1 h-8 w-40 rounded" />
                )}
                <div className="mt-2 flex gap-6 text-sm text-gray-700">
                    <span>
                        {t("store.cups")} <b>{totals?.cups ?? "–"}</b>
                    </span>
                    <span>
                        {t("store.orders")} <b>{totals?.orders ?? "–"}</b>
                    </span>
                </div>
                {totals && totals.hours.length > 0 ? (
                    <div className="mt-3 -mx-2">
                        <AreaChart
                            points={totals.hours.map((h) => ({
                                key: String(h.hour),
                                label: hourLabel(h.hour),
                                value: h.cups,
                            }))}
                            unit={t("store.cupsUnit")}
                            height={120}
                        />
                        <p className="px-2 text-xs text-gray-400">{t("store.byHour")}</p>
                    </div>
                ) : (
                    totals && (
                        <p className="mt-3 text-sm text-gray-500">{t("store.noSalesToday")}</p>
                    )
                )}
            </div>

            <SettingsGroup>
                <SettingsRow
                    to={`/${slug}/store/${storeId}/analytics`}
                    icon={<ChartNoAxesCombined {...rowIcon} />}
                    label={t("store.analyticsRow")}
                />
                <SettingsRow
                    to={`/${slug}/store/${storeId}/orders`}
                    icon={<ReceiptText {...rowIcon} />}
                    label={t("store.ordersRow")}
                />
            </SettingsGroup>
        </div>
    );
}
