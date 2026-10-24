import { loadArea } from "@tea-pos/i18n";
import { createFileRoute } from "@tanstack/react-router";

import { PayHome } from "../../../../pay/PayHome";

export const Route = createFileRoute("/_shell/$tenant/pay/")({
    // The Pay screens' words come with them, not on the first open.
    loader: () => loadArea("pay"),
    staticData: { shell: { titleKey: "nav.pay", parent: null, refreshable: true } },
    component: function Screen() {
        return <PayHome />;
    },
});
