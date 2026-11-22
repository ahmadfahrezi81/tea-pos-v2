import { createFileRoute } from "@tanstack/react-router";
import { PermissionsScreen } from "@tea-pos/shell/PermissionsScreen";

export const Route = createFileRoute("/_shell/$tenant/account/permissions")({
    staticData: { shell: { titleKey: "account.permissions", parent: ".." } },
    component: PermissionsScreen,
});
