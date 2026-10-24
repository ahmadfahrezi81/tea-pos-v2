import { createFileRoute } from "@tanstack/react-router";
import { comingSoon } from "@tea-pos/shell/ComingSoonScreen";

// Built in a later step (the RFC's build order).
export const Route = createFileRoute("/_shell/$tenant/supply")({
    staticData: { shell: { titleKey: "nav.supply", parent: null } },
    component: comingSoon("nav.supply"),
});
