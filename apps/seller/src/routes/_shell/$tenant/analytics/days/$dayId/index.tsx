import { loadArea } from "@tea-pos/i18n";
import { DayDetail } from "@tea-pos/shell/DayView";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_shell/$tenant/analytics/days/$dayId/")({
    loader: () => loadArea("store"),
    staticData: { shell: { titleKey: "analytics.details", parent: "../..", refreshable: true } },
    component: function Details() {
        return <DayDetail id={Route.useParams().dayId} />;
    },
});
