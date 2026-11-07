import { loadArea } from "@tea-pos/i18n";
import { createFileRoute } from "@tanstack/react-router";

import { SessionsPage } from "../../../../../uac/Sessions";

export const Route = createFileRoute("/_shell/$tenant/uac/$userId/sessions")({
    loader: () => loadArea("uac"),
    staticData: { shell: { titleKey: "uac.sessions", parent: ".." } },
    component: function Screen() {
        return <SessionsPage userId={Route.useParams().userId} />;
    },
});
