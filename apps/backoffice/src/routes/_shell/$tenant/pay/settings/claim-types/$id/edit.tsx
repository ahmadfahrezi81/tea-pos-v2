import { loadArea } from "@tea-pos/i18n";
import { createFileRoute } from "@tanstack/react-router";

import { ClaimTypeEdit } from "../../../../../../../pay/Types";

export const Route = createFileRoute("/_shell/$tenant/pay/settings/claim-types/$id/edit")({
    // The Pay screens' words come with them, not on the first open.
    loader: () => loadArea("pay"),
    staticData: { shell: { titleKey: "pay.editClaimType", parent: "../.." } },
    component: function Screen() {
        return <ClaimTypeEdit id={Route.useParams().id} />;
    },
});
