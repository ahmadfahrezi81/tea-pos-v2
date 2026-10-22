/// <reference types="vite-plugin-pwa/react" />

import { createContext, useContext, type ReactNode } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

/** Foreground can fire in bursts; one check a minute is plenty for a deploy. */
const CHECK_THROTTLE_MS = 60_000;
/** Stay off the network while the app boots. */
const FIRST_CHECK_DELAY_MS = 5_000;

interface AppUpdate {
    available: boolean;
    /** Activates the new worker and reloads into the new build. */
    apply: () => Promise<void>;
    /** Asked again only when the next build arrives. */
    dismiss: () => void;
}

const AppUpdateContext = createContext<AppUpdate | null>(null);

/**
 * Registers the service worker on every screen and tracks whether a newer build
 * is waiting. A till parked on the POS all shift never reloads, so the worker
 * checks again each time the app comes to the foreground; the user decides when
 * to reload, because a reload mid-order drops the cart.
 */
export function AppUpdateProvider({ children }: { children: ReactNode }) {
    const {
        needRefresh: [available, setAvailable],
        updateServiceWorker,
    } = useRegisterSW({
        // The app draws after the page's load event, which the default waits for.
        immediate: true,
        onRegisteredSW(_url, registration) {
            if (!registration) return;
            let lastCheckedAt = 0;
            const check = () => {
                if (document.visibilityState !== "visible") return;
                if (Date.now() - lastCheckedAt < CHECK_THROTTLE_MS) return;
                lastCheckedAt = Date.now();
                registration.update().catch(() => {});
            };
            setTimeout(check, FIRST_CHECK_DELAY_MS);
            document.addEventListener("visibilitychange", check);
        },
    });

    const value: AppUpdate = {
        available,
        apply: () => updateServiceWorker(true),
        dismiss: () => setAvailable(false),
    };
    return <AppUpdateContext value={value}>{children}</AppUpdateContext>;
}

export function useAppUpdate(): AppUpdate {
    const update = useContext(AppUpdateContext);
    if (!update) throw new Error("AppUpdateProvider is missing");
    return update;
}
