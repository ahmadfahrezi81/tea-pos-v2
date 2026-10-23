import {
    CACHE_MAX_AGE,
    cacheKey,
    createPersister,
    createQueryClient,
    PersistQueryClientProvider,
} from "@tea-pos/api-client/query";
import type { AppConfig } from "@tea-pos/config/app";
import { loadMessages, type Locale } from "@tea-pos/i18n";
import { pickLocale } from "@tea-pos/i18n/pick";
import { I18nProvider } from "@tea-pos/i18n/react";
import { createRouter, RouterProvider, type AnyRoute } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { AppContext } from "./AppContext";
import { AppUpdateProvider } from "./AppUpdate";
import { savedUser } from "./session";
import { hideSplash } from "./splash";
import { trackFirstLoads } from "./trackFirstLoads";
import { API_CONTRACT } from "./version";

const queryClient = createQueryClient();
trackFirstLoads(queryClient);

/** The router every app uses; the app registers its type and passes it to `startApp`. */
export function createAppRouter<TRouteTree extends AnyRoute>(routeTree: TRouteTree) {
    return createRouter({
        routeTree,
        context: { queryClient },
        // Per history entry: back returns to where you were, a new screen starts at the top.
        scrollRestoration: true,
        scrollToTopSelectors: ["#shell-scroll"],
    });
}

/** Loads the active language only, then draws the app. */
export async function startApp(router: ReturnType<typeof createAppRouter>, app: AppConfig) {
    // A screen that is ready on first draw (sign-in, not found) lifts the splash at once.
    const offRendered = router.subscribe("onRendered", () => {
        offRendered();
        if (!router.state.matches.some((m) => m.staticData.holdsSplash)) hideSplash();
    });
    // index.html already picked it, to preload that file; the same rule as pickLocale.
    const locale =
        (document.documentElement.dataset.locale as Locale | undefined) ?? pickLocale(app.locales);
    const messages = await loadMessages(locale);

    createRoot(document.getElementById("root")!).render(
        <StrictMode>
            <AppContext value={app}>
                <I18nProvider locale={locale} messages={messages}>
                    <PersistQueryClientProvider
                        client={queryClient}
                        persistOptions={{
                            persister: createPersister(cacheKey(savedUser())),
                            maxAge: CACHE_MAX_AGE,
                            // Saved data survives deploys until the API's shapes change.
                            buster: API_CONTRACT,
                        }}
                    >
                        <AppUpdateProvider>
                            <RouterProvider router={router} />
                        </AppUpdateProvider>
                    </PersistQueryClientProvider>
                </I18nProvider>
            </AppContext>
        </StrictMode>,
    );
}
