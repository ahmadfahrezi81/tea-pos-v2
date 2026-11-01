import { loadArea } from "@tea-pos/i18n";
import { createFileRoute } from "@tanstack/react-router";

import { OpenStore } from "../../../../home/OpenStore";

export const Route = createFileRoute("/_shell/$tenant/manage/open")({
    loader: () => loadArea("seller"),
    staticData: { shell: { titleKey: "manage.openStore", parent: ".." } },
    component: OpenStore,
});
