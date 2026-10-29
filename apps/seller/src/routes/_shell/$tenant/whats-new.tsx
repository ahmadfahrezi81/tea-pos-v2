import { createFileRoute } from "@tanstack/react-router";
import { WhatsNewScreen } from "@tea-pos/shell/WhatsNewScreen";

export const Route = createFileRoute("/_shell/$tenant/whats-new")({
    staticData: { shell: { titleKey: "whatsNew.title", parent: "lastRootTab" } },
    component: WhatsNewScreen,
});
