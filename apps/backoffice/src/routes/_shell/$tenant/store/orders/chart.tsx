import { createFileRoute } from "@tanstack/react-router";

import { dateSearch } from "../../../../../store/sales";
import { OrdersChart } from "../../../../../store/StoreOrders";

export const Route = createFileRoute("/_shell/$tenant/store/orders/chart")({
    validateSearch: dateSearch,
    staticData: {
        shell: {
            titleKey: "nav.dailyChart",
            parent: "..",
            refreshable: true,
            titleAccessory: true,
        },
    },
    component: function Chart() {
        return <OrdersChart date={Route.useSearch().date} />;
    },
});
