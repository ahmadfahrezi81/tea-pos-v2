import { useT } from "@tea-pos/i18n/react";
import { useTenant } from "@tea-pos/shell/tenant";
import { ChoiceList } from "@tea-pos/ui/ChoiceList";

/** The stores this person works at, one to pick (the header's picker follows): hours, default. */
export function MyStores() {
    const t = useT();
    const state = useTenant();
    const stores = state?.tenant.stores ?? [];
    if (!state || stores.length === 0)
        return <p className="bg-white rounded-2xl px-4 py-5 text-gray-900">{t("more.noStores")}</p>;
    return (
        <ChoiceList
            value={state.store?.id ?? ""}
            onChange={(id) => state.setStore(id)}
            choices={stores.map((s) => ({
                value: s.id,
                label: s.name,
                sublabel: [
                    `${s.openTime} – ${s.closeTime}`,
                    s.isDefault && t("more.default"),
                    s.status === "fake" && t("home.storeStatus.fake"),
                    s.status === "inactive" && t("home.storeStatus.inactive"),
                ]
                    .filter(Boolean)
                    .join(" · "),
                // A demo store sells like any other; only a closed one cannot be picked.
                disabled: s.status === "inactive",
            }))}
        />
    );
}
