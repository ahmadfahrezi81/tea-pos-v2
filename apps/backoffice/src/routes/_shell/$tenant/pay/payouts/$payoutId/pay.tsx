import { loadArea } from "@tea-pos/i18n";
import { comingSoon } from "@tea-pos/shell/ComingSoonScreen";
import { createFileRoute } from "@tanstack/react-router";

// Built in Step 23.
export const Route = createFileRoute("/_shell/$tenant/pay/payouts/$payoutId/pay")({
    loader: () => loadArea("pay"),
    staticData: { shell: { titleKey: "pay.confirmPayout", parent: ".." } },
    component: comingSoon("pay.confirmPayout"),
});
