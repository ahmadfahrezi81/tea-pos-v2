import { loadArea } from "@tea-pos/i18n";
import { createFileRoute } from "@tanstack/react-router";

import { Payslip } from "../../../../../../pay/Payslip";

export const Route = createFileRoute("/_shell/$tenant/pay/payouts/$payoutId/")({
    loader: () => loadArea("pay"),
    staticData: { shell: { titleKey: "pay.payslip", parent: "../..", refreshable: true } },
    component: function Screen() {
        return <Payslip id={Route.useParams().payoutId} />;
    },
});
