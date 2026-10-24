import { createFileRoute } from "@tanstack/react-router";

import { AnalyticsMonth } from "../../../../../store/AnalyticsMonth";
import { monthSearch } from "../../../../../store/sales";

export const Route = createFileRoute("/_shell/$tenant/store/analytics/")({
    validateSearch: monthSearch,
    staticData: {
        shell: { titleKey: "nav.analytics", parent: "..", refreshable: true, titleAccessory: true },
    },
    component: function Analytics() {
        return <AnalyticsMonth month={Route.useSearch().month} />;
    },
});
