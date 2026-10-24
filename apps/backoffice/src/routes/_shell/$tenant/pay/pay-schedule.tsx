import { loadArea } from "@tea-pos/i18n";
import { createFileRoute } from "@tanstack/react-router";

import { PaySchedule } from "../../../../pay/PaySchedule";

export const Route = createFileRoute("/_shell/$tenant/pay/pay-schedule")({
    // The Pay screens' words come with them, not on the first open.
    loader: () => loadArea("pay"),
    staticData: { shell: { titleKey: "pay.schedule", parent: ".." } },
    component: function Screen() {
        return <PaySchedule />;
    },
});
