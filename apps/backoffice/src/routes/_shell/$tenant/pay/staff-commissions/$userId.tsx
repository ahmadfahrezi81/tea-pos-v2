import { loadArea } from "@tea-pos/i18n";
import { createFileRoute } from "@tanstack/react-router";

import { StaffCommission } from "../../../../../pay/Staff";

export const Route = createFileRoute("/_shell/$tenant/pay/staff-commissions/$userId")({
    // The Pay screens' words come with them, not on the first open.
    loader: () => loadArea("pay"),
    staticData: { shell: { titleKey: "pay.setCommission", parent: ".." } },
    component: function Screen() {
        return <StaffCommission id={Route.useParams().userId} />;
    },
});
