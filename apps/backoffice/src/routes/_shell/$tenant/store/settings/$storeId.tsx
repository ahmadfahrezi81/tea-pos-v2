import { loadArea } from "@tea-pos/i18n";
import { createFileRoute } from "@tanstack/react-router";

import { StoreSettingsEdit } from "../../../../../store/StoreSettings";

export const Route = createFileRoute("/_shell/$tenant/store/settings/$storeId")({
    loader: () => loadArea("store"),
    staticData: { shell: { titleKey: "store.settingsTitle", parent: ".." } },
    component: function Screen() {
        return <StoreSettingsEdit storeId={Route.useParams().storeId} />;
    },
});
