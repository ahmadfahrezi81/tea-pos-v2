import { createFileRoute } from "@tanstack/react-router";
import { GoToTenant } from "@tea-pos/shell/HomeScreen";

// `/` goes to the user's tenant.
export const Route = createFileRoute("/_shell/")({
    staticData: { shell: { titleKey: "home.title", parent: null } },
    component: GoToTenant,
});
