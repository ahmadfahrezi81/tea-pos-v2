import { createFileRoute } from "@tanstack/react-router";

import { AnalyticsCharts } from "../../../../../store/AnalyticsCharts";
import { monthSearch } from "../../../../../store/sales";

export const Route = createFileRoute("/_shell/$tenant/store/analytics/charts")({
    validateSearch: monthSearch,
    staticData: {
        shell: {
            titleKey: "nav.monthlyChart",
            parent: "..",
            refreshable: true,
            titleAccessory: true,
        },
    },
    component: function Charts() {
        return <AnalyticsCharts month={Route.useSearch().month} />;
    },
});
