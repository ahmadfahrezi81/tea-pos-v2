import { createFileRoute } from "@tanstack/react-router";
import { HomeScreen } from "@tea-pos/shell/HomeScreen";

export const Route = createFileRoute("/_shell/$tenant/")({
    staticData: {
        shell: { titleKey: "home.title", parent: null, refreshable: true, titleAccessory: true },
    },
    component: HomeScreen,
});
