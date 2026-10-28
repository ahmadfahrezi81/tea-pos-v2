import { loadArea } from "@tea-pos/i18n";
import { createFileRoute } from "@tanstack/react-router";

import { PeriodHome } from "../../../../../pay/Period";

export const Route = createFileRoute("/_shell/$tenant/pay/$start/")({
    loader: () => loadArea("pay"),
    staticData: { shell: { titleKey: "nav.pay", parent: "..", refreshable: true } },
    component: function Screen() {
        return <PeriodHome start={Route.useParams().start} />;
    },
});
