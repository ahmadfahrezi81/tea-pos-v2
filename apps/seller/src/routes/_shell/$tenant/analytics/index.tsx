import { loadArea } from "@tea-pos/i18n";
import { createFileRoute } from "@tanstack/react-router";

import { Analytics } from "../../../../home/Analytics";

export const Route = createFileRoute("/_shell/$tenant/analytics/")({
    loader: () => Promise.all([loadArea("seller"), loadArea("store")]),
    staticData: { shell: { titleKey: "nav.analytics", parent: null } },
    component: Analytics,
});
