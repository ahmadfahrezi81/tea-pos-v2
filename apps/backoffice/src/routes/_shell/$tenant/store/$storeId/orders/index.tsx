import { loadArea } from "@tea-pos/i18n";
import { createFileRoute } from "@tanstack/react-router";

import { dateSearch } from "../../../../../../store/sales";
import { StoreOrders } from "../../../../../../store/StoreOrders";
import { StoreTitle } from "../../../../../../store/StoreTitle";

export const Route = createFileRoute("/_shell/$tenant/store/$storeId/orders/")({
    // The Store screens\' words come with them, not on the first open.
    loader: () => loadArea("store"),
    validateSearch: dateSearch,
    staticData: {
        shell: { titleKey: "nav.orders", parent: "..", refreshable: true },
    },
    component: function Orders() {
        return (
            <>
                <StoreTitle titleKey="nav.orders" />
                <StoreOrders date={Route.useSearch().date} />
            </>
        );
    },
});
