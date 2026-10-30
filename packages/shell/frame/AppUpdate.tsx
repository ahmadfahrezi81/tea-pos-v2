/// <reference types="vite-plugin-pwa/client" />

import { APP_TAG, onAppTooOld } from "@tea-pos/api-client/status";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { registerSW } from "virtual:pwa-register";

import { whenIdle } from "../lib/idle";

/** Foreground and taps can fire in bursts; one check a minute is plenty for a deploy. */
const CHECK_THROTTLE_MS = 60_000;
/** Stay off the network while the app boots. */
const FIRST_CHECK_DELAY_MS = 5_000;
/** After tapping Update, how long to wait for the download before reloading from the network. */
const APPLY_WAIT_MS = 10_000;

/** The build the user was offered and said no to. */
const DECLINED_KEY = "tea-pos:declined-build";

function declined(): string | null {
    try {
        return localStorage.getItem(DECLINED_KEY);
    } catch {
        return null;
    }
}

/** The build this origin serves now; null when that cannot be told, which is no reason to ask. */
async function servedBuild(): Promise<string | null> {
    try {
        const res = await fetch("/version.json", { cache: "no-store" });
        if (!res.ok) return null;
        const { version } = (await res.json()) as { version?: unknown };
        return typeof version === "string" ? version : null;
    } catch {
        return null;
    }
}

interface AppUpdate {
    available: boolean;
    /** Reloads into the new build, once it is ready or the wait is over. */
    apply: () => Promise<void>;
    /** Asked again only when the next build arrives. */
    dismiss: () => void;
}

const AppUpdateContext = createContext<AppUpdate | null>(null);

/**
 * Registers the service worker on every screen, once the first screen is up so it
 * does not compete with startup, and tells the user about a new build as soon as it
 * is out. A tiny version file is the question, asked 5 seconds after opening, on coming
 * back to the app and on a tap, at most once a minute: only a different answer touches
 * the worker, which then downloads quietly behind the sheet. The user decides when to
 * reload, because a reload mid-order drops the cart. Except after a 426: this build is
 * too old to be safe, so it reloads into the new one.
 */
export function AppUpdateProvider({ children }: { children: ReactNode }) {
    const [available, setAvailable] = useState(false);
    const [tooOld, setTooOld] = useState(false);
    const updateSW = useRef<(reload?: boolean) => Promise<void>>(async () => {});
    const registration = useRef<ServiceWorkerRegistration>(undefined);
    const served = useRef<string | null>(null);
    const ready = useRef(false);
    const onReady = useRef<() => void>(() => {});
    const applying = useRef(false);

    useEffect(() => {
        let lastCheckedAt = 0;
        const check = async () => {
            if (document.visibilityState !== "visible") return;
            if (Date.now() - lastCheckedAt < CHECK_THROTTLE_MS) return;
            lastCheckedAt = Date.now();
            const build = await servedBuild();
            if (!build || build === APP_TAG) return;
            served.current = build;
            registration.current?.update().catch(() => {});
            if (build !== declined()) setAvailable(true);
        };
        const stop = whenIdle(() => {
            updateSW.current = registerSW({
                immediate: true,
                // The browser may also find a new worker by itself: same sheet, unless declined.
                onNeedRefresh: () => {
                    ready.current = true;
                    onReady.current();
                    void servedBuild().then((build) => {
                        served.current = build;
                        if (!build || build !== declined()) setAvailable(true);
                    });
                },
                onRegisteredSW(_url, sw) {
                    registration.current = sw;
                },
            });
        });
        const first = setTimeout(() => void check(), FIRST_CHECK_DELAY_MS);
        const onEvent = () => void check();
        document.addEventListener("visibilitychange", onEvent);
        document.addEventListener("pointerdown", onEvent, { passive: true });
        return () => {
            stop?.();
            clearTimeout(first);
            document.removeEventListener("visibilitychange", onEvent);
            document.removeEventListener("pointerdown", onEvent);
        };
    }, []);

    const apply = async () => {
        // A tap and a 426 can both land here; the first one's wait decides.
        if (applying.current) return;
        applying.current = true;
        if (!ready.current) {
            const arrived = await new Promise<boolean>((resolve) => {
                onReady.current = () => resolve(true);
                setTimeout(() => resolve(false), APPLY_WAIT_MS);
            });
            if (!arrived) {
                // Too slow: without the old worker, the reload comes straight from the network.
                await registration.current?.unregister().catch(() => {});
                location.reload();
                return;
            }
        }
        await updateSW.current(true);
    };

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
        if (mayReload()) void apply();
    }, [tooOld]);

    const value: AppUpdate = {
        available,
        apply,
        dismiss: () => {
            try {
                if (served.current) localStorage.setItem(DECLINED_KEY, served.current);
            } catch {
                // Not remembered: asked again next time, nothing worse.
            }
            setAvailable(false);
        },
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
