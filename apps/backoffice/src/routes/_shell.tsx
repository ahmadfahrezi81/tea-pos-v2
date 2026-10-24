import { createFileRoute } from "@tanstack/react-router";
import { shellRoute } from "@tea-pos/shell/ShellLayout";
import { LayoutDashboard } from "lucide-react";

export const Route = createFileRoute("/_shell")(
    shellRoute([{ path: "store", labelKey: "store.title", icon: LayoutDashboard }]),
);
