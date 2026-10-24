/// <reference types="vite-plugin-pwa/client" />

import { onAppTooOld } from "@tea-pos/api-client/status";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { registerSW } from "virtual:pwa-register";

/** Foreground can fire in bursts; one check a minute is plenty for a deploy. */
const CHECK_THROTTLE_MS = 60_000;
/** Stay off the network while the app boots. */
const FIRST_CHECK_DELAY_MS = 5_000;
/** After a 426, how long to wait for the new build before reloading anyway. */
const TOO_OLD_WAIT_MS = 30_000;

interface AppUpdate {
    available: boolean;
    /** Activates the new worker and reloads into the new build. */
    apply: () => Promise<void>;
    /** Asked again only when the next build arrives. */
    dismiss: () => void;
}

const AppUpdateContext = createContext<AppUpdate | null>(null);

/** Runs `fn` once the browser is idle (soon after the first screen), or after `timeout`. */
function whenIdle(fn: () => void, timeout = 3000): () => void {
    if (typeof requestIdleCallback === "function") {
        const handle = requestIdleCallback(fn, { timeout });
        return () => cancelIdleCallback(handle);
    }
    const handle = setTimeout(fn, 1000);
    return () => clearTimeout(handle);
}

/**
 * Registers the service worker on every screen, once the first screen is up so it
 * does not compete with startup, and tracks whether a newer build is waiting. A
 * till parked on the POS all shift never reloads, so the worker checks again each
 * time the app comes to the foreground; the user decides when to reload, because
 * a reload mid-order drops the cart. Except after a 426: this build is too old to
 * be safe, so it checks at once and reloads into the new one.
 */
export function AppUpdateProvider({ children }: { children: ReactNode }) {
    const [available, setAvailable] = useState(false);
    const [tooOld, setTooOld] = useState(false);
    const updateSW = useRef<(reload?: boolean) => Promise<void>>(async () => {});
    const registration = useRef<ServiceWorkerRegistration>(undefined);

    useEffect(
        () =>
            whenIdle(() => {
                updateSW.current = registerSW({
                    immediate: true,
                    onNeedRefresh: () => setAvailable(true),
                    onRegisteredSW(_url, sw) {
                        if (!sw) return;
                        registration.current = sw;
                        let lastCheckedAt = 0;
                        const check = () => {
                            if (document.visibilityState !== "visible") return;
                            if (Date.now() - lastCheckedAt < CHECK_THROTTLE_MS) return;
                            lastCheckedAt = Date.now();
                            sw.update().catch(() => {});
                        };
                        setTimeout(check, FIRST_CHECK_DELAY_MS);
                        document.addEventListener("visibilitychange", check);
                    },
                });
            }),
        [],
    );

    useEffect(
        () =>
            onAppTooOld(() => {
                setTooOld(true);
                registration.current?.update().catch(() => {});
            }),
        [],
    );
    useEffect(() => {
        if (!tooOld) return;
        if (available) {
            if (mayReload()) void updateSW.current(true);
            return;
        }
        const handle = setTimeout(() => mayReload() && location.reload(), TOO_OLD_WAIT_MS);
        return () => clearTimeout(handle);
    }, [tooOld, available]);

    const value: AppUpdate = {
        available,
        apply: () => updateSW.current(true),
        dismiss: () => setAvailable(false),
    };
    return <AppUpdateContext value={value}>{children}</AppUpdateContext>;
}

export function useAppUpdate(): AppUpdate {
    const update = useContext(AppUpdateContext);
    if (!update) throw new Error("AppUpdateProvider is missing");
    return update;
}

const AUTO_APPLIED_KEY = "tea-pos:update-applied-at";
let autoApplied = false;

/** At most one automatic reload a minute, so a worker that fails to take over cannot loop. */
function mayReload(): boolean {
    try {
        const last = Number(sessionStorage.getItem(AUTO_APPLIED_KEY));
        if (Date.now() - last < CHECK_THROTTLE_MS) return false;
        sessionStorage.setItem(AUTO_APPLIED_KEY, String(Date.now()));
    } catch {
        // No sessionStorage: reload anyway; the worker check is throttled too.
    }
    return true;
}

/**
 * For screens outside the shell (sign-in), where there is no sheet and no cart to
 * lose: a waiting build is applied at once, at most once a minute.
 */
export function useApplyUpdateNow() {
    const { available, apply } = useAppUpdate();
    useEffect(() => {
        if (!available || autoApplied) return;
        autoApplied = true;
        if (mayReload()) void apply();
    }, [available, apply]);
}
