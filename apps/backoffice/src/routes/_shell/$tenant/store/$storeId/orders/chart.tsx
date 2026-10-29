import { loadArea } from "@tea-pos/i18n";
import { createFileRoute } from "@tanstack/react-router";

import { dateSearch } from "../../../../../../store/sales";
import { OrdersChart } from "../../../../../../store/StoreOrders";
import { StoreTitle } from "../../../../../../store/StoreTitle";

export const Route = createFileRoute("/_shell/$tenant/store/$storeId/orders/chart")({
    // The Store screens\' words come with them, not on the first open.
    loader: () => loadArea("store"),
    validateSearch: dateSearch,
    staticData: {
        shell: {
            titleKey: "nav.dailyChart",
            parent: "..",
            refreshable: true,
        },
    },
    component: function Chart() {
        return (
            <>
                <StoreTitle titleKey="nav.dailyChart" />
                <OrdersChart date={Route.useSearch().date} />
            </>
        );
    },
});
