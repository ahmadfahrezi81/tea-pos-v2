import "@tea-pos/ui/globals.css";
import { createAppRouter, startApp } from "@tea-pos/shell/app";

import app from "../app.config";
import { routeTree } from "./routeTree.gen";

const router = createAppRouter(routeTree);

declare module "@tanstack/react-router" {
    interface Register {
        router: typeof router;
    }
}

void startApp(router, app);
