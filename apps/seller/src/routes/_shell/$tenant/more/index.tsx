import { loadArea } from "@tea-pos/i18n";
import { createFileRoute } from "@tanstack/react-router";

import { More } from "../../../../more/More";

export const Route = createFileRoute("/_shell/$tenant/more/")({
    loader: () => loadArea("seller"),
    staticData: { shell: { titleKey: "nav.more", parent: null } },
    component: More,
});
