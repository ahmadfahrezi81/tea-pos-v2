import { loadArea } from "@tea-pos/i18n";
import { createFileRoute } from "@tanstack/react-router";

import { PayHelp } from "../../../../pay/PayHelp";

export const Route = createFileRoute("/_shell/$tenant/pay/help")({
    loader: () => loadArea("pay"),
    staticData: { shell: { titleKey: "pay.helpTitle", parent: ".." } },
    component: PayHelp,
});
