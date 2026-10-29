import type { MessageKey } from "@tea-pos/i18n";
import { useT } from "@tea-pos/i18n/react";
import { HeaderTitle } from "@tea-pos/shell/HeaderActions";
import { useTenant } from "@tea-pos/shell/tenant";

import { ALL, useStoreId } from "./sales";

/** A store screen's title says which store: `Laladon STG · Analytics`, `All stores · Orders`. */
export function StoreTitle({ titleKey }: { titleKey: MessageKey }) {
    const t = useT();
    const storeId = useStoreId();
    const stores = useTenant()?.tenant.stores;
    const name =
        storeId === ALL ? t("shell.allStores") : stores?.find((s) => s.id === storeId)?.name;
    return name ? <HeaderTitle>{`${name} · ${t(titleKey)}`}</HeaderTitle> : null;
}
