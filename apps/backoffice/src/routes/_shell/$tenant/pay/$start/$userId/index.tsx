import { loadArea } from "@tea-pos/i18n";
import { createFileRoute } from "@tanstack/react-router";

import { PersonPayslip } from "../../../../../../pay/PersonPayslip";

export const Route = createFileRoute("/_shell/$tenant/pay/$start/$userId/")({
    loader: () => loadArea("pay"),
    staticData: { shell: { titleKey: "pay.payslip", parent: "..", refreshable: true } },
    component: function Screen() {
        const { start, userId } = Route.useParams();
        return <PersonPayslip start={start} userId={userId} />;
    },
});
