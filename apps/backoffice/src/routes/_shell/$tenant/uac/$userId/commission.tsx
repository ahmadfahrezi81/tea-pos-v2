import { loadArea } from "@tea-pos/i18n";
import { createFileRoute } from "@tanstack/react-router";

import { PersonSetting } from "../../../../../uac/PersonPage";

export const Route = createFileRoute("/_shell/$tenant/uac/$userId/commission")({
    loader: () => Promise.all([loadArea("uac"), loadArea("pay")]),
    staticData: { shell: { titleKey: "pay.commissionType", parent: ".." } },
    component: function Screen() {
        return <PersonSetting userId={Route.useParams().userId} part="commission" />;
    },
});
