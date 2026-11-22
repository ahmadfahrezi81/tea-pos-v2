import { loadArea } from "@tea-pos/i18n";
import { createFileRoute } from "@tanstack/react-router";

import { ShareAction } from "@tea-pos/chat/ShareAction";
import { DayDetail } from "@tea-pos/shell/DayView";
import { StoreTitle } from "../../../../../../../../store/StoreTitle";

export const Route = createFileRoute("/_shell/$tenant/store/$storeId/analytics/days/$dayId/")({
    // The Store screens\' words come with them, not on the first open.
    loader: () => loadArea("store"),
    staticData: {
        shell: { titleKey: "nav.daySummaryDetails", parent: "../..", refreshable: true },
    },
    component: function Day() {
        return (
            <>
                <StoreTitle titleKey="nav.daySummaryDetails" dayId={Route.useParams().dayId} />
                <ShareAction link={{ kind: "day", id: Route.useParams().dayId }} />
                <DayDetail id={Route.useParams().dayId} />
            </>
        );
    },
});
