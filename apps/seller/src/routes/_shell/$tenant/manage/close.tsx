import { loadArea } from "@tea-pos/i18n";
import { createFileRoute } from "@tanstack/react-router";

import { CloseDay } from "../../../../home/CloseDay";

export const Route = createFileRoute("/_shell/$tenant/manage/close")({
    loader: () => Promise.all([loadArea("seller"), loadArea("store")]),
    staticData: { shell: { titleKey: "manage.closeDay", parent: ".." } },
    component: CloseDay,
});
