import { loadArea } from "@tea-pos/i18n";
import { createFileRoute } from "@tanstack/react-router";

import { PersonPage } from "../../../../uac/PersonPage";

export const Route = createFileRoute("/_shell/$tenant/uac/$userId")({
    loader: () => loadArea("uac"),
    staticData: { shell: { titleKey: "nav.uac", parent: "..", refreshable: true } },
    component: function Screen() {
        return <PersonPage userId={Route.useParams().userId} />;
    },
});
