import { createFileRoute } from "@tanstack/react-router";
import { shellRoute } from "@tea-pos/shell/ShellLayout";

export const Route = createFileRoute("/_shell")(shellRoute);
