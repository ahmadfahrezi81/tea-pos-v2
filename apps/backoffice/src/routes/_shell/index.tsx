import { createFileRoute } from "@tanstack/react-router";
import { StatusScreen } from "@tea-pos/shell/StatusScreen";

export const Route = createFileRoute("/_shell/")({
    staticData: { shell: { titleKey: "status.title", parent: null, refreshable: true } },
    component: StatusScreen,
});
