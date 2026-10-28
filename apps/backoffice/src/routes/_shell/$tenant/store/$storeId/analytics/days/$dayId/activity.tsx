import { loadArea } from "@tea-pos/i18n";
import { createFileRoute } from "@tanstack/react-router";

import { DayActivity } from "../../../../../../../../store/DayActivity";

export const Route = createFileRoute(
    "/_shell/$tenant/store/$storeId/analytics/days/$dayId/activity",
)({
    // The Store screens\' words come with them, not on the first open.
    loader: () => loadArea("store"),
    staticData: { shell: { titleKey: "nav.dayActivity", parent: "../../..", refreshable: true } },
    component: function Activity() {
        return <DayActivity id={Route.useParams().dayId} />;
    },
});
