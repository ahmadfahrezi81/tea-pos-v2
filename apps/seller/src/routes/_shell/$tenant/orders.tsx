import { createFileRoute } from "@tanstack/react-router";
import { comingSoon } from "@tea-pos/shell/ComingSoonScreen";

// Built in a later step (the RFC's build order).
export const Route = createFileRoute("/_shell/$tenant/orders")({
    staticData: { shell: { titleKey: "nav.orders", parent: null } },
    component: comingSoon("nav.orders"),
});
