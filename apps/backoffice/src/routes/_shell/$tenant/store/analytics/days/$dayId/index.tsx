import { createFileRoute } from "@tanstack/react-router";

import { DayDetail } from "../../../../../../../store/DayDetail";

export const Route = createFileRoute("/_shell/$tenant/store/analytics/days/$dayId/")({
    staticData: {
        shell: { titleKey: "nav.daySummaryDetails", parent: "../..", refreshable: true },
    },
    component: function Day() {
        return <DayDetail id={Route.useParams().dayId} />;
    },
});
