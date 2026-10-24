import { createFileRoute } from "@tanstack/react-router";
import { shellRoute } from "@tea-pos/shell/ShellLayout";
import {
    ChartNoAxesCombined,
    Layers,
    MessagesSquare,
    ReceiptText,
    ShoppingCart,
} from "lucide-react";

// The old seller app's tabs; More is added by the shell. POS shows as Manage inside manage.
export const Route = createFileRoute("/_shell")(
    shellRoute([
        {
            path: "pos",
            labelKey: "nav.pos",
            icon: ShoppingCart,
            also: ["manage"],
            variant: { path: "manage", labelKey: "nav.manage", icon: Layers },
        },
        { path: "orders", labelKey: "nav.orders", icon: ReceiptText },
        { path: "analytics", labelKey: "nav.analytics", icon: ChartNoAxesCombined },
        { path: "chats", labelKey: "nav.chats", icon: MessagesSquare },
    ]),
);
