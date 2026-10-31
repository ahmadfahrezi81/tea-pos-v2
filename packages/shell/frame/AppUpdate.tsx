/// <reference types="vite-plugin-pwa/client" />

import { APP_TAG, onAppTooOld } from "@tea-pos/api-client/status";
import { useT } from "@tea-pos/i18n/react";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { registerSW } from "virtual:pwa-register";

import { whenIdle } from "../lib/idle";
import { useApp } from "../session/AppContext";

/** Taps can fire in bursts; one check a minute is plenty for a deploy. */
const CHECK_THROTTLE_MS = 60_000;
/** How long a download may run before it is left for the next open. */
const DOWNLOAD_LIMIT_MS = 60_000;
/**
 * All files saved, but the phone never says a worker is waiting (seen on iPhone): how long to give it
 * before calling the download done anyway.
 */
const SETTLE_MS = 5_000;
/** How often the download's progress is read. */
const PROGRESS_MS = 400;
/** A longer gap between progress reads means the phone slept. */
const PAUSED_MS = 5_000;
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

const ATTEMPT_KEY = "tea-pos:update-attempt";

/** How many times this phone has tried to reach `build`; survives the reload that follows. */
function attempts(build: string | null): number {
    if (!build) return 0;
    try {
        const saved = JSON.parse(localStorage.getItem(ATTEMPT_KEY) ?? "{}") as {
            build?: string;
            count?: number;
        };
        return saved.build === build ? (saved.count ?? 0) : 0;
    } catch {
        return 0;
    }
}

function markAttempt(build: string | null) {
    if (!build) return;
    try {
        localStorage.setItem(ATTEMPT_KEY, JSON.stringify({ build, count: attempts(build) + 1 }));
    } catch {
        // Not remembered: one reload more, and the file count still limits nothing worse.
    }
}

/** Tried this many times and still behind: stop asking until the next build; More has Update app. */
const MAX_ATTEMPTS = 2;

/** `backoffice@2026.10.8+a1b2c3d` as `2026.10.8`. */
const versionOf = (build: string) => build.split("@")[1]?.split("+")[0] ?? "";

async function currentRegistration(
    known: ServiceWorkerRegistration | undefined,
): Promise<ServiceWorkerRegistration | undefined> {
    try {
        return (await navigator.serviceWorker.getRegistration()) ?? known;
    } catch {
        return known;
    }
}

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

/**
 * The way out when the normal flow fails: no worker and no saved files, so the reload comes straight
 * from the network. Kept apart from it on purpose. False, changing nothing, when the new build cannot
 * be fetched: without saved files the app could not open again.
 */
async function forceUpdate(): Promise<boolean> {
    if (!(await servedBuild())) return false;
    try {
        const entry = (await newWorkerFiles()).find((f) => /\/assets\/index-.*\.js/.test(f));
        if (entry && !(await fetch(entry, { cache: "no-store" })).ok) return false;
    } catch {
        return false;
    }
    const registrations = await navigator.serviceWorker?.getRegistrations().catch(() => []);
    await Promise.all((registrations ?? []).map((r) => r.unregister().catch(() => false)));
    await clearCaches();
    location.reload();
    return true;
}

/** This build's version, for showing. */
export const currentVersion = () => versionOf(APP_TAG);

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
 * How the update is going. `downloading` runs behind the app, `ready` counts down to the reload;
 * `blocking` is the full page.
 */
type Phase = "idle" | "downloading" | "ready";

interface AppUpdate {
    phase: Phase;
    /** 0 to 100; null until it can be told. */
    percent: number | null;
    /** Reloads into the new build, which has finished downloading. */
    apply: () => Promise<void>;
    /** The Update app row: asks now, whatever was decided before. */
    checkNow: () => Promise<"latest" | "offline" | "started">;
}

const AppUpdateContext = createContext<AppUpdate | null>(null);

/**
 * An update is a download: the app lives on the phone, and a reload alone is answered by the old
 * worker with the old files. A tiny version file is the question, asked on opening, on coming back
 * and on a tap, at most once a minute. On a fresh open a new build takes a full page until it is
 * in (nobody has started anything); in use it downloads behind a toast at the top, which then
 * counts down and reloads. After a 426 this build is too old to
 * be safe, so the full page has no way out.
 */
export function AppUpdateProvider({ children }: { children: ReactNode }) {
    const [phase, setPhase] = useState<Phase>("idle");
    const [percent, setPercent] = useState<number | null>(null);
    const [blocking, setBlocking] = useState(false);
    const forced = useRef(false);
    const [version, setVersion] = useState("");
    const updateSW = useRef<(reload?: boolean) => Promise<void>>(async () => {});
    const registration = useRef<ServiceWorkerRegistration>(undefined);
    // Nothing tapped yet since opening: a full page interrupts nothing.
    const fresh = useRef(true);
    const blockingRef = useRef(false);
    const stopWatching = useRef<() => void>(() => {});
    // Said no, or got out, this session: asked again on the next open.
    const quiet = useRef(false);
    const applying = useRef(false);
    const target = useRef<string | null>(null);
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
        // The second try gets past whatever kept the first on the old build.
        const again = attempts(target.current) > 0;
        markAttempt(target.current);
        if (again && (await forceUpdate())) return;
        const reg = await currentRegistration(registration.current);
        if (reg?.waiting) {
            await takeOver(reg.waiting, TAKE_OVER_MS);
            location.reload();
            return;
        }
        // No worker to hand over to: only leaving the old one behind reaches the new build.
        if (!(await forceUpdate())) location.reload();
    };

    // The limit passed. The first time wait for the next open; the second clears and reloads.
    const giveUp = async () => {
        const tries = attempts(target.current);
        markAttempt(target.current);
        if (forced.current) {
            if (tries >= MAX_ATTEMPTS || !(await forceUpdate())) download();
            return;
        }
        block(false);
        quiet.current = true;
        setPhase("idle");
        if (tries > 0) await forceUpdate();
    };

    // Follows the new worker until it waits to take over, or the limit passes.
    const download = () => {
        stopWatching.current();
        setPhase("downloading");
        setPercent(null);
        let started = 0;
        let lastTick = 0;
        let pending: string[] | null = null;
        let total = 0;
        let stopped = false;
        let savedAt = 0;
        const finish = () => {
            setPercent(100);
            setPhase("ready");
            if (blockingRef.current) void apply();
        };
        const tick = async () => {
            if (stopped) return;
            // Asked afresh each time: a phone may not update the object it handed out.
            const reg = await currentRegistration(registration.current);
            registration.current = reg;
            if (reg?.waiting) return finish();
            if (savedAt && Date.now() - savedAt > SETTLE_MS) return finish();
            // Time behind a locked screen is not the download's.
            const now = Date.now();
            if (!started) started = lastTick = now;
            if (now - lastTick > PAUSED_MS) started += now - lastTick;
            lastTick = now;
            if (now - started > DOWNLOAD_LIMIT_MS) return void giveUp();
            try {
                if (!pending) {
                    const saved = await savedFiles();
                    pending = (await newWorkerFiles()).filter((f) => !saved.has(f));
                    total = pending.length;
                    if (total === 0) savedAt = Date.now();
                } else if (total > 0) {
                    const saved = await savedFiles();
                    const left = pending.filter((f) => !saved.has(f)).length;
                    // Only ever forward: the worker may move files between caches as it goes.
                    const done = Math.round(((total - left) / total) * 100);
                    setPercent((was) => Math.max(was ?? 0, done));
                    if (left === 0 && !savedAt) savedAt = Date.now();
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
            if (phaseRef.current !== "idle" || !registration.current) return;
            if (Date.now() - lastCheckedAt < CHECK_THROTTLE_MS) return;
            lastCheckedAt = Date.now();
            const openedFresh = fresh.current;
            const build = await servedBuild();
            if (!build || build === APP_TAG) return;
            if (attempts(build) >= MAX_ATTEMPTS) return;
            target.current = build;
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
                        if (quiet.current || attempts(build) >= MAX_ATTEMPTS) return;
                        target.current = build;
                        if (build) setVersion(versionOf(build));
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
        // A screen's code from the build this page started on is gone: only a new page can open it.
        const onChunkGone = (e: Event) => {
            e.preventDefault();
            void servedBuild().then((build) => {
                if (build && build !== APP_TAG && attempts(build) < MAX_ATTEMPTS) {
                    markAttempt(build);
                    location.reload();
                }
            });
        };
        window.addEventListener("vite:preloadError", onChunkGone);
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
            window.removeEventListener("vite:preloadError", onChunkGone);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(
        () =>
            onAppTooOld(() => {
                forced.current = true;
                block(true);
                // Asked first: this build must not keep reloading if the server stays ahead of it.
                void servedBuild().then((build) => {
                    target.current = build;
                    if (build) setVersion(versionOf(build));
                    download();
                });
            }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );

    const value: AppUpdate = {
        phase,
        percent,
        apply,
        checkNow: async () => {
            const build = await servedBuild();
            if (!build) return "offline";
            if (build === APP_TAG) return "latest";
            target.current = build;
            setVersion(versionOf(build));
            if (phaseRef.current === "idle") download();
            return "started";
        },
    };
    return (
        <AppUpdateContext value={value}>
            {children}
            {blocking && <UpdateScreen version={version} phase={phase} percent={percent} />}
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
    phase,
    percent,
}: {
    version: string;
    phase: Phase;
    percent: number | null;
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
            <p className="text-sm text-gray-900">{t("shell.updateKeepOpen")}</p>
        </div>
    );
}
