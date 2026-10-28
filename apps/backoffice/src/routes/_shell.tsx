import { createFileRoute } from "@tanstack/react-router";
import { shellRoute } from "@tea-pos/shell/ShellLayout";
import { DollarSign, MessagesSquare, Store, UsersRound } from "lucide-react";

// The backoffice's three cores and Chats (coming); More is added by the shell.
export const Route = createFileRoute("/_shell")(
    shellRoute([
        { path: "store", labelKey: "store.title", icon: Store },
        { path: "pay", labelKey: "nav.pay", icon: DollarSign },
        { path: "uac", labelKey: "nav.uac", icon: UsersRound },
        { path: "chats", labelKey: "nav.chats", icon: MessagesSquare },
    ]),
);
