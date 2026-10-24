import { loadArea } from "@tea-pos/i18n";
import { createFileRoute } from "@tanstack/react-router";

import { CommissionTypeEdit } from "../../../../../../pay/Types";

export const Route = createFileRoute("/_shell/$tenant/pay/commission-types/$id/edit")({
    // The Pay screens' words come with them, not on the first open.
    loader: () => loadArea("pay"),
    staticData: { shell: { titleKey: "pay.editCommissionType", parent: "../.." } },
    component: function Screen() {
        return <CommissionTypeEdit id={Route.useParams().id} />;
    },
});
