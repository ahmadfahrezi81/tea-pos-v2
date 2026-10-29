import { createFileRoute } from "@tanstack/react-router";

import { StoreList } from "../../../../store/StoreList";

export const Route = createFileRoute("/_shell/$tenant/store/")({
    staticData: { shell: { titleKey: "store.title", parent: null, refreshable: true } },
    component: StoreList,
});
