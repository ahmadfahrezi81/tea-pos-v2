import { loadArea } from "@tea-pos/i18n";
import { HeaderActions } from "@tea-pos/shell/HeaderActions";
import { useAccess } from "@tea-pos/shell/tenant";
import { createFileRoute } from "@tanstack/react-router";

import { StoreSettingsList } from "../../../../../store/StoreSettings";

export const Route = createFileRoute("/_shell/$tenant/store/settings/")({
    loader: () => loadArea("store"),
    staticData: { shell: { titleKey: "store.settingsTitle", parent: "..", refreshable: true } },
    component: function Screen() {
        const { canWrite } = useAccess();
        return (
            <>
                {canWrite && <HeaderActions actions={[{ kind: "add", to: "add" }]} />}
                <StoreSettingsList />
            </>
        );
    },
});
