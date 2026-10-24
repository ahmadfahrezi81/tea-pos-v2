import { loadArea } from "@tea-pos/i18n";
import { createFileRoute } from "@tanstack/react-router";

import { ClaimTypeList } from "../../../../../pay/Types";

export const Route = createFileRoute("/_shell/$tenant/pay/claim-types/")({
    // The Pay screens' words come with them, not on the first open.
    loader: () => loadArea("pay"),
    staticData: {
        shell: {
            titleKey: "pay.claimTypes",
            parent: "..",
            refreshable: true,
            inlineHeader: true,
            headerAction: "add",
        },
    },
    component: function Screen() {
        return <ClaimTypeList />;
    },
});
