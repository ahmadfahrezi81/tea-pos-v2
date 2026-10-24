import { loadArea } from "@tea-pos/i18n";
import { createFileRoute } from "@tanstack/react-router";

import { StaffCommissionList } from "../../../../../pay/Staff";

export const Route = createFileRoute("/_shell/$tenant/pay/staff-commissions/")({
    // The Pay screens' words come with them, not on the first open.
    loader: () => loadArea("pay"),
    staticData: { shell: { titleKey: "pay.staffCommissions", parent: "..", refreshable: true } },
    component: function Screen() {
        return <StaffCommissionList />;
    },
});
