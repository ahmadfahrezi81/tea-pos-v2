import { loadArea } from "@tea-pos/i18n";
import { createFileRoute } from "@tanstack/react-router";

import { PersonEdit } from "../../../../../uac/PersonPage";

export const Route = createFileRoute("/_shell/$tenant/uac/$userId/edit")({
    loader: () => loadArea("uac"),
    staticData: { shell: { titleKey: "uac.editTitle", parent: ".." } },
    component: function Screen() {
        return <PersonEdit userId={Route.useParams().userId} />;
    },
});
