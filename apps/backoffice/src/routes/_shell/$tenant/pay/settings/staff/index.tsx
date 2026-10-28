import { loadArea } from "@tea-pos/i18n";
import { createFileRoute } from "@tanstack/react-router";

import { StaffInfoList } from "../../../../../../pay/Staff";

export const Route = createFileRoute("/_shell/$tenant/pay/settings/staff/")({
    // The Pay screens' words come with them, not on the first open.
    loader: () => loadArea("pay"),
    staticData: { shell: { titleKey: "pay.staffInfo", parent: "..", refreshable: true } },
    component: function Screen() {
        return <StaffInfoList />;
    },
});
