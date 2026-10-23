import { createFileRoute } from "@tanstack/react-router";
import { HomeScreen } from "@tea-pos/shell/HomeScreen";

export const Route = createFileRoute("/_shell/")({
    staticData: { shell: { titleKey: "home.title", parent: null, refreshable: true } },
    component: HomeScreen,
});
