import { createFileRoute } from "@tanstack/react-router";
import { StatusScreen } from "@tea-pos/shell/StatusScreen";

export const Route = createFileRoute("/_shell/$tenant/app-info")({
    staticData: { shell: { titleKey: "status.title", parent: "lastRootTab" } },
    component: StatusScreen,
});
