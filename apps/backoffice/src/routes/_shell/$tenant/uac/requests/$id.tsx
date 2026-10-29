import { loadArea } from "@tea-pos/i18n";
import { createFileRoute } from "@tanstack/react-router";

import { RequestPage } from "../../../../../uac/RequestPage";

export const Route = createFileRoute("/_shell/$tenant/uac/requests/$id")({
    loader: () => loadArea("uac"),
    staticData: { shell: { titleKey: "nav.uac", parent: "../..", refreshable: true } },
    component: function Screen() {
        return <RequestPage id={Route.useParams().id} />;
    },
});
