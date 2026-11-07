import { loadArea } from "@tea-pos/i18n";
import { createFileRoute } from "@tanstack/react-router";

import { StoreSettingsAdd } from "../../../../../store/StoreSettings";

export const Route = createFileRoute("/_shell/$tenant/store/settings/add")({
    loader: () => loadArea("store"),
    staticData: { shell: { titleKey: "storeSettings.new", parent: ".." } },
    component: StoreSettingsAdd,
});
