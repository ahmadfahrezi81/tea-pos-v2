import { loadArea } from "@tea-pos/i18n";
import { createFileRoute } from "@tanstack/react-router";

import { AnalyticsCharts } from "../../../../../../store/AnalyticsCharts";
import { monthSearch } from "../../../../../../store/sales";

export const Route = createFileRoute("/_shell/$tenant/store/$storeId/analytics/charts")({
    // The Store screens\' words come with them, not on the first open.
    loader: () => loadArea("store"),
    validateSearch: monthSearch,
    staticData: {
        shell: {
            titleKey: "nav.monthlyChart",
            parent: "..",
            refreshable: true,
        },
    },
    component: function Charts() {
        return <AnalyticsCharts month={Route.useSearch().month} />;
    },
});
