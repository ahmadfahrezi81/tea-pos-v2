import { loadArea } from "@tea-pos/i18n";
import { createFileRoute } from "@tanstack/react-router";

import { FeedbackMap } from "../../../../more/FeedbackMap";

export const Route = createFileRoute("/_shell/$tenant/more/map")({
    loader: () => loadArea("more"),
    staticData: { shell: { titleKey: "moreRows.feedback", parent: "..", refreshable: true } },
    component: FeedbackMap,
});
