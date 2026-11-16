import { createFileRoute } from "@tanstack/react-router";
import { ScreenLabScreen } from "@tea-pos/shell/ScreenLabScreen";

export const Route = createFileRoute("/_shell/$tenant/screen-lab")({
    staticData: { shell: { titleKey: "more.screenLab", parent: "lastRootTab" } },
    component: ScreenLabScreen,
});
