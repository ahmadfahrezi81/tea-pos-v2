import { createFileRoute } from "@tanstack/react-router";

import { StoreOverview } from "../../../../store/StoreOverview";

export const Route = createFileRoute("/_shell/$tenant/store/")({
    staticData: {
        shell: { titleKey: "store.title", parent: null, refreshable: true, titleAccessory: true },
    },
    component: StoreOverview,
});
