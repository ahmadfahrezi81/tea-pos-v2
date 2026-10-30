import { loadArea } from "@tea-pos/i18n";
import { createFileRoute } from "@tanstack/react-router";

import { HelpTopics } from "../../../../HelpTopics";

export const Route = createFileRoute("/_shell/$tenant/store/help")({
    loader: () => loadArea("store"),
    staticData: { shell: { titleKey: "store.helpTitle", parent: ".." } },
    component: function Screen() {
        return <HelpTopics area="storeHelp" topics={["Range", "Home", "Store", "Fresh"]} />;
    },
});
