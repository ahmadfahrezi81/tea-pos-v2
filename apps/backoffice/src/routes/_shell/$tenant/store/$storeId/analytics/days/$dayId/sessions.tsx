import { loadArea } from "@tea-pos/i18n";
import { createFileRoute } from "@tanstack/react-router";

import { DaySessions } from "../../../../../../../../store/DayActivity";
import { StoreTitle } from "../../../../../../../../store/StoreTitle";

export const Route = createFileRoute(
    "/_shell/$tenant/store/$storeId/analytics/days/$dayId/sessions",
)({
    // The Store screens\' words come with them, not on the first open.
    loader: () => loadArea("store"),
    staticData: { shell: { titleKey: "nav.daySessions", parent: "../../..", refreshable: true } },
    component: function Sessions() {
        return (
            <>
                <StoreTitle titleKey="nav.daySessions" dayId={Route.useParams().dayId} />
                <DaySessions id={Route.useParams().dayId} />
            </>
        );
    },
});
