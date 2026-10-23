import { createFileRoute } from "@tanstack/react-router";
import { SignInScreen } from "@tea-pos/shell/SignInScreen";

export const Route = createFileRoute("/login")({ component: SignInScreen });
