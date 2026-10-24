import { createFileRoute } from "@tanstack/react-router";

import { dateSearch } from "../../../../../store/sales";
import { StoreOrders } from "../../../../../store/StoreOrders";

export const Route = createFileRoute("/_shell/$tenant/store/orders/")({
    validateSearch: dateSearch,
    staticData: {
        shell: { titleKey: "nav.orders", parent: "..", refreshable: true, titleAccessory: true },
    },
    component: function Orders() {
        return <StoreOrders date={Route.useSearch().date} />;
    },
});
