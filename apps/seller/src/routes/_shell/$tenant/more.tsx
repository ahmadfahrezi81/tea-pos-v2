import { createFileRoute } from "@tanstack/react-router";
import { MoreScreen } from "@tea-pos/shell/MoreScreen";

export const Route = createFileRoute("/_shell/$tenant/more")({
    staticData: { shell: { titleKey: "nav.more", parent: null } },
    component: MoreScreen,
});
