import { loadArea } from "@tea-pos/i18n";
import { createFileRoute } from "@tanstack/react-router";

import { Orders } from "../../../home/Orders";

export const Route = createFileRoute("/_shell/$tenant/orders")({
    loader: () => loadArea("store"),
    staticData: { shell: { titleKey: "nav.orders", parent: null } },
    component: Orders,
});
