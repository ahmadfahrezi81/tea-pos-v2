import { loadArea } from "@tea-pos/i18n";
import { createFileRoute } from "@tanstack/react-router";

import { AccessHelp } from "../../../../uac/AccessHelp";

export const Route = createFileRoute("/_shell/$tenant/uac/help")({
    loader: () => loadArea("uac"),
    staticData: { shell: { titleKey: "uac.helpTitle", parent: ".." } },
    component: AccessHelp,
});
