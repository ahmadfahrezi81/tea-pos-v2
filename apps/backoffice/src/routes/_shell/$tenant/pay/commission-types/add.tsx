import { loadArea } from "@tea-pos/i18n";
import { createFileRoute } from "@tanstack/react-router";

import { CommissionTypeAdd } from "../../../../../pay/Types";

export const Route = createFileRoute("/_shell/$tenant/pay/commission-types/add")({
    // The Pay screens' words come with them, not on the first open.
    loader: () => loadArea("pay"),
    staticData: { shell: { titleKey: "pay.newCommissionType", parent: ".." } },
    component: function Screen() {
        return <CommissionTypeAdd />;
    },
});
