import { loadArea } from "@tea-pos/i18n";
import { createFileRoute } from "@tanstack/react-router";

import { PayoutList } from "../../../../../pay/Payouts";

export const Route = createFileRoute("/_shell/$tenant/pay/payouts/")({
    loader: () => loadArea("pay"),
    staticData: { shell: { titleKey: "pay.payouts", parent: "..", refreshable: true } },
    component: PayoutList,
});
