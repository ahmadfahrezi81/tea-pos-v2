import { createFileRoute } from "@tanstack/react-router";
import { shellRoute } from "@tea-pos/shell/ShellLayout";
import { House } from "lucide-react";

export const Route = createFileRoute("/_shell")(
    shellRoute([{ path: "", labelKey: "home.title", icon: House }]),
);
