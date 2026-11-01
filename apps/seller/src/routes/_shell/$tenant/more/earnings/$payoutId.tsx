import { loadArea } from "@tea-pos/i18n";
import { createFileRoute } from "@tanstack/react-router";

import { MyPayslip } from "../../../../../more/MyPay";

export const Route = createFileRoute("/_shell/$tenant/more/earnings/$payoutId")({
    loader: () => Promise.all([loadArea("seller"), loadArea("store")]),
    staticData: { shell: { titleKey: "more.myPay", parent: ".." } },
    component: Page,
});

function Page() {
    return <MyPayslip id={Route.useParams().payoutId} />;
}
