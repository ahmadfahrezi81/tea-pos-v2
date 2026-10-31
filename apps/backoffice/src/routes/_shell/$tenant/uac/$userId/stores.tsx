import { loadArea } from "@tea-pos/i18n";
import { createFileRoute } from "@tanstack/react-router";

import { PersonSetting } from "../../../../../uac/PersonPage";

export const Route = createFileRoute("/_shell/$tenant/uac/$userId/stores")({
    loader: () => Promise.all([loadArea("uac"), loadArea("pay")]),
    staticData: { shell: { titleKey: "uac.stores", parent: ".." } },
    component: function Screen() {
        return <PersonSetting userId={Route.useParams().userId} part="stores" />;
    },
});
