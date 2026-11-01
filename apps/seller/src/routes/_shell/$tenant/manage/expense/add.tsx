import { loadArea } from "@tea-pos/i18n";
import { createFileRoute } from "@tanstack/react-router";

import { AddExpense } from "../../../../../home/Expenses";

export const Route = createFileRoute("/_shell/$tenant/manage/expense/add")({
    loader: () => loadArea("seller"),
    staticData: { shell: { titleKey: "manage.submitExpense", parent: ".." } },
    component: AddExpense,
});
