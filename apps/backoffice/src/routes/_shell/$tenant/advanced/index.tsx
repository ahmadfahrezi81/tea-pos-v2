import { loadArea } from "@tea-pos/i18n";
import { createFileRoute } from "@tanstack/react-router";

import { Advanced } from "../../../../more/Advanced";

export const Route = createFileRoute("/_shell/$tenant/advanced/")({
    loader: () => loadArea("pay"),
    staticData: { shell: { titleKey: "pay.advancedTitle", parent: "lastRootTab" } },
    component: Advanced,
});
