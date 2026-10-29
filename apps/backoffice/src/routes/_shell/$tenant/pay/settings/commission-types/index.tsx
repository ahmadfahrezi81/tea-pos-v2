import { loadArea } from "@tea-pos/i18n";
import { createFileRoute } from "@tanstack/react-router";
import { HeaderActions } from "@tea-pos/shell/HeaderActions";

import { CommissionTypeList } from "../../../../../../pay/Types";

export const Route = createFileRoute("/_shell/$tenant/pay/settings/commission-types/")({
    // The Pay screens' words come with them, not on the first open.
    loader: () => loadArea("pay"),
    staticData: {
        shell: {
            titleKey: "pay.commissionTypes",
            parent: "..",
            refreshable: true,
        },
    },
    component: function Screen() {
        return (
            <>
                <HeaderActions actions={[{ kind: "add", to: "add" }]} />
                <CommissionTypeList />
            </>
        );
    },
});
