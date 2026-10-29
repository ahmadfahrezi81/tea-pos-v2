import { formatTime, localDate } from "@tea-pos/format";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { HeaderTitle } from "@tea-pos/shell/HeaderActions";
import { rowIcon, SettingsGroup, SettingsRow } from "@tea-pos/shell/Settings";
import { useTenant } from "@tea-pos/shell/tenant";
import { Avatar } from "@tea-pos/ui/Avatar";
import { ChartNoAxesCombined, ReceiptText, Store } from "lucide-react";

import { closedLine, OpenBadge } from "./StoreList";
import { TodayPanel } from "./TodayPanel";
import { ALL, useSalesHours, useStoreId, useStoresLive } from "./sales";
import { Panel } from "@tea-pos/ui/Panel";

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

            <TodayPanel totals={totals} hours={totals?.hours} />

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
