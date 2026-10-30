import { loadArea } from "@tea-pos/i18n";
import { createFileRoute, redirect } from "@tanstack/react-router";

import { rangeSearch } from "../../../../../store/range";
import { ALL } from "../../../../../store/sales";
import { StorePage } from "../../../../../store/StorePage";

export const Route = createFileRoute("/_shell/$tenant/store/$storeId/")({
    validateSearch: rangeSearch,
    // All stores together is the home itself; its Orders and Day by day come back there.
    beforeLoad: ({ params, search }) => {
        if (params.storeId === ALL)
            throw redirect({
                to: "/$tenant/store",
                params: { tenant: params.tenant },
                search,
                replace: true,
            });
    },
    // The Store screens' words come with them, not on the first open.
    loader: () => loadArea("store"),
    staticData: { shell: { titleKey: "store.title", parent: "..", refreshable: true } },
    component: StorePage,
});
