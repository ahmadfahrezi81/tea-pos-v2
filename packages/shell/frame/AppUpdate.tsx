/// <reference types="vite-plugin-pwa/client" />

import { APP_TAG, onAppTooOld } from "@tea-pos/api-client/status";
import { useT } from "@tea-pos/i18n/react";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { registerSW } from "virtual:pwa-register";

import { whenIdle } from "../lib/idle";
import { useApp } from "../session/AppContext";

/** Taps can fire in bursts; one check a minute is plenty for a deploy. */
const CHECK_THROTTLE_MS = 60_000;
/** How long a download may run before the full page offers a way out, or the toast a retry. */
const DOWNLOAD_LIMIT_MS = 60_000;
/** How often the download's progress is read. */
const PROGRESS_MS = 400;
/** After the new worker is told to take over, how long to wait for it before reloading anyway. */
const TAKE_OVER_MS = 3_000;

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

const APPLIED_KEY = "tea-pos:update-applied-at";

function markApplied() {
    try {
        sessionStorage.setItem(APPLIED_KEY, String(Date.now()));
    } catch {
        // Not remembered: one reload more at worst.
    }
}

/** Reloaded for an update a moment ago: if still behind, no full page again, so it cannot loop. */
function justApplied(): boolean {
    try {
        return Date.now() - Number(sessionStorage.getItem(APPLIED_KEY)) < CHECK_THROTTLE_MS;
    } catch {
        return false;
    }
}

/** `backoffice@2026.10.8+a1b2c3d` as `2026.10.8`. */
const versionOf = (build: string) => build.split("@")[1]?.split("+")[0] ?? "";

/** Tells the waiting worker to take over and waits until it has, or `ms` has passed. */
function takeOver(worker: ServiceWorker, ms: number): Promise<void> {
    return new Promise((resolve) => {
        const timer = setTimeout(resolve, ms);
        worker.addEventListener("statechange", () => {
            if (worker.state !== "activated") return;
            clearTimeout(timer);
            resolve();
        });
        worker.postMessage({ type: "SKIP_WAITING" });
    });
}

async function clearCaches(): Promise<void> {
    try {
        await Promise.all((await caches.keys()).map((key) => caches.delete(key)));
    } catch {
        // No caches to clear: the reload still goes ahead.
    }
}

/** Every address the precache holds, whichever cache the worker is writing to. */
async function savedFiles(): Promise<Set<string>> {
    const saved = new Set<string>();
    for (const name of await caches.keys()) {
        if (!name.includes("precache")) continue;
        const requests = await (await caches.open(name)).keys();
        for (const r of requests) saved.add(new URL(r.url).pathname + new URL(r.url).search);
    }
    return saved;
}

/** What the new worker will save: its own list, read from its script. */
async function newWorkerFiles(): Promise<string[]> {
    const text = await (await fetch("/sw.js", { cache: "no-store" })).text();
    return [...text.matchAll(/url:"([^"]+)",revision:(?:null|"([^"]+)")/g)].map(([, url, rev]) => {
        const path = `/${(url ?? "").replace(/^\//, "")}`;
        return rev ? `${path}?__WB_REVISION__=${rev}` : path;
    });
}

/**
 * How the update is going. `downloading` runs behind the app, `ready` waits for the user;
 * `blocking` is the full page, `stuck` that page or the toast after the download's limit.
 */
type Phase = "idle" | "downloading" | "ready" | "stuck";

interface AppUpdate {
    phase: Phase;
    /** 0 to 100; null until it can be told. */
    percent: number | null;
    /** Reloads into the new build, which has finished downloading. */
    apply: () => Promise<void>;
    /** Asks again only on the next open. */
    later: () => void;
    /** Starts the download again. */
    retry: () => void;
}

const AppUpdateContext = createContext<AppUpdate | null>(null);

/**
 * An update is a download: the app lives on the phone, and a reload alone is answered by the old
 * worker with the old files. A tiny version file is the question, asked on opening, on coming back
 * and on a tap, at most once a minute. On a fresh open a new build takes a full page until it is
 * in (nobody has started anything); in use it downloads behind a toast at the top, then a sheet
 * asks to reload, because a reload mid-order drops the cart. After a 426 this build is too old to
 * be safe, so the full page has no way out.
 */
export function AppUpdateProvider({ children }: { children: ReactNode }) {
    const [phase, setPhase] = useState<Phase>("idle");
    const [percent, setPercent] = useState<number | null>(null);
    const [blocking, setBlocking] = useState(false);
    const [forced, setForced] = useState(false);
    const [version, setVersion] = useState("");
    const updateSW = useRef<(reload?: boolean) => Promise<void>>(async () => {});
    const registration = useRef<ServiceWorkerRegistration>(undefined);
    // Nothing tapped yet since opening: a full page interrupts nothing.
    const fresh = useRef(!justApplied());
    const blockingRef = useRef(false);
    const stopWatching = useRef<() => void>(() => {});
    // Said no, or got out, this session: asked again on the next open.
    const quiet = useRef(false);
    const applying = useRef(false);
    const phaseRef = useRef<Phase>("idle");
    useEffect(() => {
        phaseRef.current = phase;
    }, [phase]);

    const block = (on: boolean) => {
        blockingRef.current = on;
        setBlocking(on);
    };

    const apply = async () => {
        if (applying.current) return;
        applying.current = true;
        markApplied();
        const waiting = registration.current?.waiting;
        if (waiting) await takeOver(waiting, TAKE_OVER_MS);
        location.reload();
    };

    // Follows the new worker until it waits to take over, or the limit passes.
    const download = () => {
        stopWatching.current();
        setPhase("downloading");
        setPercent(null);
        const started = Date.now();
        let pending: string[] | null = null;
        let total = 0;
        let stopped = false;
        const tick = async () => {
            if (stopped) return;
            const reg = registration.current;
            if (reg?.waiting) {
                setPercent(100);
                setPhase("ready");
                if (blockingRef.current) void apply();
                return;
            }
            if (Date.now() - started > DOWNLOAD_LIMIT_MS) return setPhase("stuck");
            try {
                if (!pending) {
                    const saved = await savedFiles();
                    pending = (await newWorkerFiles()).filter((f) => !saved.has(f));
                    total = pending.length;
                } else if (total > 0) {
                    const saved = await savedFiles();
                    const left = pending.filter((f) => !saved.has(f)).length;
                    // Only ever forward: the worker may move files between caches as it goes.
                    const now = Math.round(((total - left) / total) * 100);
                    setPercent((was) => Math.max(was ?? 0, now));
                }
            } catch {
                // Progress unknown: the bar just keeps moving.
            }
            setTimeout(() => void tick(), PROGRESS_MS);
        };
        stopWatching.current = () => {
            stopped = true;
        };
        registration.current?.update().catch(() => {});
        void tick();
    };

    useEffect(() => {
        let lastCheckedAt = 0;
        const check = async () => {
            if (document.visibilityState !== "visible" || quiet.current) return;
            if (phaseRef.current !== "idle") return;
            if (Date.now() - lastCheckedAt < CHECK_THROTTLE_MS) return;
            lastCheckedAt = Date.now();
            const openedFresh = fresh.current;
            const build = await servedBuild();
            if (!build || build === APP_TAG) return;
            setVersion(versionOf(build));
            if (openedFresh) block(true);
            download();
        };
        const stop = whenIdle(() => {
            updateSW.current = registerSW({
                immediate: true,
                // Only apply reloads; a worker changing behind a current page must not.
                onNeedReload: () => {},
                // A worker already waiting, or found by the browser itself.
                onNeedRefresh: () => {
                    void servedBuild().then((build) => {
                        // This page already runs that build: nothing to offer, just let the worker in.
                        if (build === APP_TAG) {
                            void updateSW.current(false);
                            return;
                        }
                        if (build) setVersion(versionOf(build));
                        if (quiet.current) return;
                        if (fresh.current) block(true);
                        download();
                    });
                },
                onRegisteredSW(_url, sw) {
                    registration.current = sw;
                    void check();
                },
            });
        });
        const onVisible = () => void check();
        const onTap = () => {
            fresh.current = false;
            void check();
        };
        document.addEventListener("visibilitychange", onVisible);
        document.addEventListener("pointerdown", onTap, { passive: true });
        return () => {
            stop();
            stopWatching.current();
            document.removeEventListener("visibilitychange", onVisible);
            document.removeEventListener("pointerdown", onTap);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(
        () =>
            onAppTooOld(() => {
                setForced(true);
                block(true);
                download();
            }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );

    const value: AppUpdate = {
        phase,
        percent,
        apply,
        later: () => {
            quiet.current = true;
            stopWatching.current();
            setPhase("idle");
        },
        retry: download,
    };
    return (
        <AppUpdateContext value={value}>
            {children}
            {blocking && (
                <UpdateScreen
                    version={version}
                    forced={forced}
                    onExit={() => {
                        block(false);
                        value.later();
                    }}
                    onRetry={() => {
                        // The worker could not get through: start clean, straight from the network.
                        void (async () => {
                            await registration.current?.unregister().catch(() => {});
                            await clearCaches();
                            location.reload();
                        })();
                    }}
                    phase={phase}
                    percent={percent}
                />
            )}
        </AppUpdateContext>
    );
}

export function useAppUpdate(): AppUpdate {
    const update = useContext(AppUpdateContext);
    if (!update) throw new Error("AppUpdateProvider is missing");
    return update;
}

/** A bar for the download: filled to `percent`, or sweeping while that is unknown. */
export function UpdateBar({ percent, dark = false }: { percent: number | null; dark?: boolean }) {
    return (
        <div
            className={`h-1.5 overflow-hidden rounded-full ${dark ? "bg-white/25" : "bg-gray-200"}`}
        >
            {percent === null ? (
                <div className="skeleton h-full w-full" />
            ) : (
                <div
                    className={`h-full rounded-full transition-[width] duration-300 ${dark ? "bg-white" : "bg-brand"}`}
                    style={{ width: `${percent}%` }}
                />
            )}
        </div>
    );
}

/** The full page: what a fresh open sees while the new build comes in, like installing an app. */
function UpdateScreen({
    version,
    forced,
    phase,
    percent,
    onExit,
    onRetry,
}: {
    version: string;
    forced: boolean;
    phase: Phase;
    percent: number | null;
    onExit: () => void;
    onRetry: () => void;
}) {
    const t = useT();
    const app = useApp();
    const logo = app.signIn.logo ?? "/icons/icon-192x192.png";
    const done = phase === "ready";
    return (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-white p-8 text-center animate-fade-in">
            <img
                src={logo}
                alt=""
                width={88}
                height={88}
                className={`rounded-[28.6%] ${done ? "" : "animate-pulse"}`}
            />
            <div className="space-y-1">
                <p className="text-xl font-bold text-gray-900">
                    {t("shell.updating").replace("{app}", app.shortName)}
                </p>
                {version && <p className="text-sm text-gray-900">{version}</p>}
            </div>
            <div className="w-full max-w-xs space-y-2">
                <UpdateBar percent={percent} />
                <p className="text-sm font-medium text-gray-900">
                    {done
                        ? t("shell.updateDone")
                        : percent === null
                          ? t("shell.updateDownloading")
                          : `${t("shell.updateDownloading")} ${percent}%`}
                </p>
            </div>
            {phase === "stuck" ? (
                <div className="w-full max-w-xs space-y-2">
                    <button
                        onClick={onRetry}
                        className="w-full rounded-xl bg-brand py-3.5 font-semibold text-white active:scale-[0.98]"
                    >
                        {t("shell.updateRetry")}
                    </button>
                    {!forced && (
                        <button
                            onClick={onExit}
                            className="w-full py-3 font-medium text-gray-900 active:opacity-70"
                        >
                            {t("shell.updateContinue")}
                        </button>
                    )}
                </div>
            ) : (
                <p className="text-sm text-gray-900">{t("shell.updateKeepOpen")}</p>
            )}
        </div>
    );
}
