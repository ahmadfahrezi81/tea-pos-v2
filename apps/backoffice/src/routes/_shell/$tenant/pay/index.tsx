import { loadArea } from "@tea-pos/i18n";
import { createFileRoute } from "@tanstack/react-router";

import { periodSearch } from "../../../../pay/pay";
import { PeriodHome } from "../../../../pay/Period";

export const Route = createFileRoute("/_shell/$tenant/pay/")({
    // The Pay screens' words come with them, not on the first open.
    loader: () => loadArea("pay"),
    validateSearch: periodSearch,
    staticData: { shell: { titleKey: "nav.pay", parent: null, refreshable: true } },
    component: function Screen() {
        return <PeriodHome start={Route.useSearch().period ?? "current"} />;
    },
});
