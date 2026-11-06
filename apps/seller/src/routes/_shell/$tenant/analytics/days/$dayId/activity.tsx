import { loadArea } from "@tea-pos/i18n";
import { DayActivity } from "@tea-pos/shell/DayActivity";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_shell/$tenant/analytics/days/$dayId/activity")({
    loader: () => loadArea("store"),
    staticData: { shell: { titleKey: "analytics.activity", parent: "..", refreshable: true } },
    component: function Activity() {
        return <DayActivity id={Route.useParams().dayId} />;
    },
});
