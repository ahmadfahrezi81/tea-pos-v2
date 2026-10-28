import { loadArea } from "@tea-pos/i18n";
import { createFileRoute } from "@tanstack/react-router";

import { PaySettings } from "../../../../../pay/PaySettings";

export const Route = createFileRoute("/_shell/$tenant/pay/settings/")({
    loader: () => loadArea("pay"),
    staticData: { shell: { titleKey: "pay.settingsTitle", parent: ".." } },
    component: PaySettings,
});
