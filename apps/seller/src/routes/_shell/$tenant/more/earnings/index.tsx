import { loadArea } from "@tea-pos/i18n";
import { createFileRoute } from "@tanstack/react-router";

import { MyPay } from "../../../../../more/MyPay";

export const Route = createFileRoute("/_shell/$tenant/more/earnings/")({
    loader: () => Promise.all([loadArea("seller"), loadArea("store")]),
    staticData: { shell: { titleKey: "more.myPay", parent: ".." } },
    component: MyPay,
});
