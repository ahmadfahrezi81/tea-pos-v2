import { createFileRoute } from "@tanstack/react-router";
import { ScreenLabCaseScreen } from "@tea-pos/shell/ScreenLabScreen";

export const Route = createFileRoute("/_shell/$tenant/screen-lab/$case")({
    staticData: { shell: { titleKey: "more.screenLab", parent: ".." } },
    component: function Screen() {
        return <ScreenLabCaseScreen caseId={Route.useParams().case} />;
    },
});
