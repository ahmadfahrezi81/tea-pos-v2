import { loadArea } from "@tea-pos/i18n";
import { createFileRoute } from "@tanstack/react-router";

import { MyClaims } from "../../../../../more/MyClaims";

export const Route = createFileRoute("/_shell/$tenant/more/claims/")({
    loader: () => Promise.all([loadArea("seller"), loadArea("store")]),
    staticData: { shell: { titleKey: "more.myClaims", parent: ".." } },
    component: MyClaims,
});
