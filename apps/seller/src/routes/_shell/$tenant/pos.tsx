import { loadArea } from "@tea-pos/i18n";
import { createFileRoute } from "@tanstack/react-router";

import { POS } from "../../../home/POS";

export const Route = createFileRoute("/_shell/$tenant/pos")({
    loader: () => loadArea("seller"),
    staticData: { shell: { titleKey: "nav.pos", parent: null } },
    component: POS,
});
