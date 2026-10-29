import { formatMoney, formatTime, localDate } from "@tea-pos/format";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { HeaderTitle } from "@tea-pos/shell/HeaderActions";
import { rowIcon, SettingsGroup, SettingsRow } from "@tea-pos/shell/Settings";
import { useTenant } from "@tea-pos/shell/tenant";
import { AreaChart } from "@tea-pos/ui/AreaChart";
import { Avatar } from "@tea-pos/ui/Avatar";
import { Banknote, ChartNoAxesCombined, ReceiptText, Store } from "lucide-react";

import { closedLine, OpenBadge } from "./StoreList";
import { ALL, useSalesHours, useStoreId, useStoresLive } from "./sales";
import { Skeleton } from "@tea-pos/ui/Skeleton";
import { Panel, PanelLabel } from "@tea-pos/ui/Panel";

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

    const tile = "rounded-xl bg-slate-100 p-3";
    return (
        <div className="flex flex-col gap-3">
            <HeaderTitle>{all ? t("shell.allStores") : (store?.name ?? "")}</HeaderTitle>

            {store && (
                <Panel
                    icon={<Store {...rowIcon} />}
                    title={t("store.rightNow")}
                    beside={<OpenBadge store={store} />}
                >
                    <div className={`${tile} flex items-center gap-3`}>
                        {store.open ? (
                            <>
                                <Avatar url={store.sellerAvatar} size={40} square />
                                <div className="min-w-0">
                                    <p className="truncate font-semibold text-gray-900">
                                        {t("store.isSelling").replace(
                                            "{name}",
                                            store.sellerName ?? "",
                                        )}
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
                            <p className="text-gray-900">{closedLine(store, t, locale)}</p>
                        )}
                    </div>
                </Panel>
            )}

            <Panel icon={<Banknote {...rowIcon} />} title={t("store.todayLabel")}>
                {totals ? (
                    <p className="px-1 text-3xl font-bold text-gray-900">
                        {formatMoney(totals.sales)}
                    </p>
                ) : (
                    <Skeleton className="h-9 w-44 rounded" />
                )}
                <div className="grid grid-cols-2 gap-2">
                    {(
                        [
                            ["store.cups", totals?.cups],
                            ["store.orders", totals?.orders],
                        ] as const
                    ).map(([key, value]) => (
                        <div key={key} className={tile}>
                            <p className="text-sm text-gray-900">{t(key)}</p>
                            <p className="text-xl font-bold text-gray-900">{value ?? "–"}</p>
                        </div>
                    ))}
                </div>
                {totals &&
                    (totals.hours.length > 0 ? (
                        <div className={tile}>
                            <PanelLabel>{t("store.cupsByHour")}</PanelLabel>
                            <div className="-mx-2 mt-2">
                                <AreaChart
                                    points={totals.hours.map((h) => ({
                                        key: String(h.hour),
                                        label: hourLabel(h.hour),
                                        value: h.cups,
                                    }))}
                                    unit={t("store.cupsUnit")}
                                    height={120}
                                />
                            </div>
                        </div>
                    ) : (
                        <p className={`${tile} text-sm text-gray-900`}>{t("store.noSalesToday")}</p>
                    ))}
            </Panel>

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
