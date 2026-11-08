import { localDate } from "@tea-pos/format";
import { useT } from "@tea-pos/i18n/react";
import { HeaderTitle } from "@tea-pos/shell/HeaderActions";
import { rowIcon, SettingsGroup, SettingsRow } from "@tea-pos/shell/Settings";
import { useSlug } from "@tea-pos/shell/tenant";
import { ChartNoAxesCombined, Info, ReceiptText } from "lucide-react";

import { RangeBar, useRange } from "./range";
import { RangePanel } from "./RangePanel";
import { useDays, useScopeStores, useStoreId } from "./sales";
import { Sellers } from "@tea-pos/shell/Sellers";
import { useStatus } from "./StoreList";

/**
 * One store over the range: who is on (today), the numbers and who sold, then Orders and the
 * day's Details (a range: Analytics) for going further.
 */
export function StorePage() {
    const t = useT();
    const slug = useSlug();
    const storeId = useStoreId();
    const { from, to, single, isToday } = useRange();
    const { stores } = useScopeStores(from, to);
    const store = stores?.[0];
    // Only one day needs them here, to go straight to its detail; a range's list loads when opened.
    const days = useDays(from, to, single);
    const search = { from, to };
    // One day of one store: straight to its detail, there is no list to scroll.
    const onlyDay = single && days.data?.days.length === 1 ? days.data.days[0] : undefined;

    // One day: how it went (Open · 10:02, Closed · 19:06), and who sells while open.
    const status = useStatus();
    const open = isToday && !!store?.open;
    const facts =
        store && single
            ? [
                  {
                      label: t("store.status"),
                      value: status(store, { single, isToday, open, today: to === localDate() })
                          .text,
                  },
                  ...(open && store.sellerName
                      ? [{ label: t("store.sellerLabel"), value: store.sellerName }]
                      : []),
              ]
            : [];

    return (
        <div className="flex flex-col gap-3">
            <HeaderTitle>{store?.name ?? ""}</HeaderTitle>
            <RangeBar />

            {/* A range's sellers sit in the same card, under the chart. */}
            <RangePanel stores={stores} facts={facts}>
                {store && !isToday && store.sellers.length > 0 && (
                    <Sellers sellers={store.sellers} />
                )}
            </RangePanel>

            <SettingsGroup>
                <SettingsRow
                    to={`/${slug}/store/${storeId}/orders`}
                    search={search}
                    icon={<ReceiptText {...rowIcon} />}
                    label={t("store.orders")}
                />
                <SettingsRow
                    to={
                        onlyDay
                            ? `/${slug}/store/${storeId}/analytics/days/${onlyDay.id}`
                            : `/${slug}/store/${storeId}/analytics`
                    }
                    search={onlyDay ? undefined : search}
                    icon={single ? <Info {...rowIcon} /> : <ChartNoAxesCombined {...rowIcon} />}
                    label={t(single ? "store.details" : "store.dayByDay")}
                />
            </SettingsGroup>
        </div>
    );
}
