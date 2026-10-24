import { createFileRoute } from "@tanstack/react-router";
import { AccountScreen } from "@tea-pos/shell/AccountScreen";

export const Route = createFileRoute("/_shell/$tenant/account")({
    staticData: { shell: { titleKey: "account.title", parent: "lastRootTab" } },
    component: AccountScreen,
});
