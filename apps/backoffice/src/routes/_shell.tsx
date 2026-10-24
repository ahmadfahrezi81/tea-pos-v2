import { createFileRoute } from "@tanstack/react-router";
import { shellRoute } from "@tea-pos/shell/ShellLayout";
import { DollarSign, LayoutDashboard, MessagesSquare, Package } from "lucide-react";

// The old backoffice's tabs; More is added by the shell.
export const Route = createFileRoute("/_shell")(
    shellRoute([
        { path: "store", labelKey: "store.title", icon: LayoutDashboard },
        { path: "pay", labelKey: "nav.pay", icon: DollarSign },
        { path: "supply", labelKey: "nav.supply", icon: Package },
        { path: "chats", labelKey: "nav.chats", icon: MessagesSquare },
    ]),
);
