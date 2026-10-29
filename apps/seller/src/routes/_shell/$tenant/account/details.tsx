import { createFileRoute } from "@tanstack/react-router";
import { PersonalDetailsScreen } from "@tea-pos/shell/PersonalDetailsScreen";

export const Route = createFileRoute("/_shell/$tenant/account/details")({
    staticData: { shell: { titleKey: "account.personalDetails", parent: ".." } },
    component: PersonalDetailsScreen,
});
