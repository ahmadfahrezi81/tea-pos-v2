import { loadArea } from "@tea-pos/i18n";
import { createFileRoute } from "@tanstack/react-router";

import { StorePage } from "../../../../../store/StorePage";

export const Route = createFileRoute("/_shell/$tenant/store/$storeId/")({
    // The Store screens' words come with them, not on the first open.
    loader: () => loadArea("store"),
    staticData: { shell: { titleKey: "store.title", parent: "..", refreshable: true } },
    component: StorePage,
});
