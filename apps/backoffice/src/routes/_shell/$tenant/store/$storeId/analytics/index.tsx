import { loadArea } from "@tea-pos/i18n";
import { createFileRoute } from "@tanstack/react-router";

import { AnalyticsMonth } from "../../../../../../store/AnalyticsMonth";
import { monthSearch } from "../../../../../../store/sales";

export const Route = createFileRoute("/_shell/$tenant/store/$storeId/analytics/")({
    // The Store screens\' words come with them, not on the first open.
    loader: () => loadArea("store"),
    validateSearch: monthSearch,
    staticData: {
        shell: { titleKey: "nav.analytics", parent: "..", refreshable: true },
    },
    component: function Analytics() {
        return <AnalyticsMonth month={Route.useSearch().month} />;
    },
});
