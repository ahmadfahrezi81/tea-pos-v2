import type { MessageKey } from "@tea-pos/i18n";
import { useT } from "@tea-pos/i18n/react";
import { HeaderTitle } from "@tea-pos/shell/HeaderActions";
import { useTenant } from "@tea-pos/shell/tenant";

import { ALL, useDay, useStoreId } from "./sales";

/**
 * A store screen's title says which store: `Laladon STG · Analytics`, `All stores · Orders`.
 * A day's screens name the day's own store, even reached from All stores.
 */
export function StoreTitle({ titleKey, dayId }: { titleKey: MessageKey; dayId?: string }) {
    const t = useT();
    const storeId = useStoreId();
    const stores = useTenant()?.tenant.stores;
    const day = useDay(dayId ?? "");
    const name = dayId
        ? day.data?.storeName
        : storeId === ALL
          ? t("shell.allStores")
          : stores?.find((s) => s.id === storeId)?.name;
    return name ? <HeaderTitle>{`${name} · ${t(titleKey)}`}</HeaderTitle> : null;
}
