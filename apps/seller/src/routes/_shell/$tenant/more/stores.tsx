import { loadArea } from "@tea-pos/i18n";
import { createFileRoute } from "@tanstack/react-router";

import { MyStores } from "../../../../more/MyStores";

export const Route = createFileRoute("/_shell/$tenant/more/stores")({
    loader: () => loadArea("seller"),
    staticData: { shell: { titleKey: "more.myStores", parent: ".." } },
    component: MyStores,
});
