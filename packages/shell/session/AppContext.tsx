import type { AppConfig } from "@tea-pos/config/app";
import { createContext, useContext } from "react";

export const AppContext = createContext<AppConfig | null>(null);

/** The running app's config (`app.config.ts`). */
export function useApp(): AppConfig {
    const app = useContext(AppContext);
    if (!app) throw new Error("startApp did not provide the app config");
    return app;
}
