import { loadArea } from "@tea-pos/i18n";
import { createFileRoute } from "@tanstack/react-router";

import { UacHome } from "../../../../uac/UacHome";

export const Route = createFileRoute("/_shell/$tenant/uac/")({
    // UAC's words come with it, not on the first open.
    loader: () => loadArea("uac"),
    staticData: { shell: { titleKey: "nav.uac", parent: null, refreshable: true } },
    component: UacHome,
});
