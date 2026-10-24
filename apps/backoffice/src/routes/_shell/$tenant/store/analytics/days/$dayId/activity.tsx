import { createFileRoute } from "@tanstack/react-router";

import { DayActivity } from "../../../../../../../store/DayActivity";

export const Route = createFileRoute("/_shell/$tenant/store/analytics/days/$dayId/activity")({
    staticData: { shell: { titleKey: "nav.dayActivity", parent: "../../..", refreshable: true } },
    component: function Activity() {
        return <DayActivity id={Route.useParams().dayId} />;
    },
});
