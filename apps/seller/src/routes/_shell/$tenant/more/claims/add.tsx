import { loadArea } from "@tea-pos/i18n";
import { createFileRoute } from "@tanstack/react-router";

import { AddClaim } from "../../../../../more/MyClaims";

export const Route = createFileRoute("/_shell/$tenant/more/claims/add")({
    loader: () => loadArea("seller"),
    staticData: { shell: { titleKey: "claims.new", parent: ".." } },
    component: AddClaim,
});
