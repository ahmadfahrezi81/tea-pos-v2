import { loadArea } from "@tea-pos/i18n";
import { createFileRoute } from "@tanstack/react-router";

import { Manage } from "../../../../home/Manage";

export const Route = createFileRoute("/_shell/$tenant/manage/")({
    loader: () => loadArea("seller"),
    staticData: { shell: { titleKey: "nav.manage", parent: null } },
    component: Manage,
});
