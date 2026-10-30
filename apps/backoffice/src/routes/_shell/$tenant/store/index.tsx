import { createFileRoute } from "@tanstack/react-router";

import { rangeSearch } from "../../../../store/range";
import { StoreList } from "../../../../store/StoreList";

export const Route = createFileRoute("/_shell/$tenant/store/")({
    validateSearch: rangeSearch,
    staticData: { shell: { titleKey: "store.title", parent: null, refreshable: true } },
    component: StoreList,
});
