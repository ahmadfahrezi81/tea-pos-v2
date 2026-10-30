import { loadArea } from "@tea-pos/i18n";
import { createFileRoute } from "@tanstack/react-router";

import { AnalyticsCharts } from "../../../../../../store/AnalyticsCharts";
import { rangeSearch } from "../../../../../../store/range";
import { StoreTitle } from "../../../../../../store/StoreTitle";

export const Route = createFileRoute("/_shell/$tenant/store/$storeId/analytics/charts")({
    // The Store screens\' words come with them, not on the first open.
    loader: () => loadArea("store"),
    validateSearch: rangeSearch,
    staticData: {
        shell: {
            titleKey: "nav.monthlyChart",
            parent: "..",
            refreshable: true,
        },
    },
    component: function Charts() {
        return (
            <>
                <StoreTitle titleKey="nav.monthlyChart" />
                <AnalyticsCharts />
            </>
        );
    },
});
