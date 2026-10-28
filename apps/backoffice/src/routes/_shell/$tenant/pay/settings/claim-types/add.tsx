import { loadArea } from "@tea-pos/i18n";
import { createFileRoute } from "@tanstack/react-router";

import { ClaimTypeAdd } from "../../../../../../pay/Types";

export const Route = createFileRoute("/_shell/$tenant/pay/settings/claim-types/add")({
    // The Pay screens' words come with them, not on the first open.
    loader: () => loadArea("pay"),
    staticData: { shell: { titleKey: "pay.newClaimType", parent: ".." } },
    component: function Screen() {
        return <ClaimTypeAdd />;
    },
});
