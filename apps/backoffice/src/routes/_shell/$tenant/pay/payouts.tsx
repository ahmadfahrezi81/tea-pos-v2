import { loadArea } from "@tea-pos/i18n";
import { comingSoon } from "@tea-pos/shell/ComingSoonScreen";
import { createFileRoute } from "@tanstack/react-router";

// Built in Step 23.
export const Route = createFileRoute("/_shell/$tenant/pay/payouts")({
    loader: () => loadArea("pay"),
    staticData: { shell: { titleKey: "pay.payouts", parent: ".." } },
    component: comingSoon("pay.payouts"),
});
