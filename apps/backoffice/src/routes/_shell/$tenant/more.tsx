import { loadArea } from "@tea-pos/i18n";
import { MoreScreen } from "@tea-pos/shell/MoreScreen";
import { createFileRoute } from "@tanstack/react-router";

import { MoreRows } from "../../../more/MoreRows";

export const Route = createFileRoute("/_shell/$tenant/more")({
    loader: () => loadArea("more"),
    staticData: { shell: { titleKey: "nav.more", parent: null } },
    component: function More() {
        return <MoreScreen rows={<MoreRows />} />;
    },
});
