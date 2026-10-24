import { loadArea } from "@tea-pos/i18n";
import { createFileRoute } from "@tanstack/react-router";

import { PayConfirm } from "../../../../../../pay/PayConfirm";

export const Route = createFileRoute("/_shell/$tenant/pay/payouts/$payoutId/pay")({
    loader: () => loadArea("pay"),
    staticData: { shell: { titleKey: "pay.confirmPayout", parent: ".." } },
    component: function Screen() {
        return <PayConfirm id={Route.useParams().payoutId} />;
    },
});
