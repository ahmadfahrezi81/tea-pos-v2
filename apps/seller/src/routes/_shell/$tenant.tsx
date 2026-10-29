import { createFileRoute } from "@tanstack/react-router";
import { TenantGuard } from "@tea-pos/shell/HomeScreen";

export const Route = createFileRoute("/_shell/$tenant")({ component: TenantGuard });
