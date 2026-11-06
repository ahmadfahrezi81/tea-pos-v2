import { loadArea } from "@tea-pos/i18n";
import { createFileRoute } from "@tanstack/react-router";

import { Expenses } from "../../../../../home/Expenses";

export const Route = createFileRoute("/_shell/$tenant/manage/expense/")({
    loader: () => loadArea("seller"),
    staticData: { shell: { titleKey: "manage.expenses", parent: "..", refreshable: true } },
    component: Expenses,
});
