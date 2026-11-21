import { createFileRoute } from "@tanstack/react-router";
import { NotificationsScreen } from "@tea-pos/shell/NotificationsScreen";

export const Route = createFileRoute("/_shell/$tenant/account/notifications")({
    staticData: { shell: { titleKey: "account.notifications", parent: ".." } },
    component: NotificationsScreen,
});
