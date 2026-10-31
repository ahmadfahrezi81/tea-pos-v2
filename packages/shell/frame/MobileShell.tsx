import { useQueryClient } from "@tanstack/react-query";
import {
    Outlet,
    useCanGoBack,
    useMatches,
    useRouter,
    useRouterState,
} from "@tanstack/react-router";
import { useT } from "@tea-pos/i18n/react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { FooterSlotContext } from "./FooterSlotContext";
import { HeaderSlotContext, HeaderTitleSlotContext } from "./HeaderActions";
import { MobileFooterNav } from "./MobileFooterNav";
import { MobileHeader } from "./MobileHeader";
import { navProgress } from "./navProgress";
import "./nav-progress.css";
import { RefreshSheet } from "./RefreshSheet";
import { refreshGate } from "./refreshGate";
import { isSubPage, type Tab } from "./routes";
import { ScrollContext } from "./ScrollContext";
import { useStandaloneViewportHeight } from "./useStandaloneViewportHeight";

/** Pull distance, after resistance, at which letting go refreshes. */
const PULL_THRESHOLD_PX = 64;
/** However far the finger goes, the content stops here. */
const PULL_MAX_PX = 120;
/** Shapes the resistance curve. Smaller is stiffer. */
const PULL_STIFFNESS_PX = 160;
/** The gap held open under the header while a refresh runs. */
const PULL_HOLD_PX = 56;
/** A refresh holds the gap at least this long, so a fast one never just blinks. */
const PULL_MIN_SPIN_MS = 400;
/** How long the gap takes to close. */
const PULL_CLOSE_MS = 280;
/** How long the spinner takes to fade after a refresh. Matches `.pull-spinner[data-state="leaving"]`. */
const PULL_SPINNER_FADE_MS = 150;

// A plain function, named so the compiler does not mistake it for a ref read.
const attachBar = navProgress.attach;

export interface MobileShellProps {
    /** Absolute paths of the root tabs. */
    rootTabPaths: string[];
    tabs: Tab[];
    /** Where "back" lands from a route whose parent is `null`. */
    homePath: string;
    avatarUrl?: string | null;
    /** Without it the account button is hidden. */
    onAccount?: () => void;
    /** Always-mounted extras, e.g. a picker drawer. */
    extras?: ReactNode;
    /** Covers the whole shell: the boot screen, maintenance, auth errors. */
    overlay?: ReactNode;
    /** False until the app's own startup data has arrived; gates the content. */
    ready: boolean;
}

/**
 * The mobile shell for every app: header, content, bottom chrome, as flex
 * children so content gets exactly the space left. The router supplies route
 * data (`staticData.shell`), scroll memory and back (`useCanGoBack`).
 */
export function MobileShell({
    rootTabPaths,
    tabs,
    homePath,
    avatarUrl,
    onAccount,
    extras,
    overlay,
    ready,
}: MobileShellProps) {
    const t = useT();
    const router = useRouter();
    const queryClient = useQueryClient();
    const canGoBack = useCanGoBack();
    // Header and content follow the committed route; the tab highlight follows the tap.
    const pathname = useRouterState({
        select: (s) => (s.resolvedLocation ?? s.location).pathname,
    });
    const navPath = useRouterState({ select: (s) => s.location.pathname });
    const route = useMatches({
        select: (matches) => matches.findLast((m) => m.staticData.shell)?.staticData.shell,
    });

    // A DOM node pages portal into, so a page's footer never re-renders the shell.
    const [footerSlotEl, setFooterSlotEl] = useState<HTMLDivElement | null>(null);
    const [headerSlotEl, setHeaderSlotEl] = useState<HTMLDivElement | null>(null);
    const [titleSlotEl, setTitleSlotEl] = useState<HTMLSpanElement | null>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const pullSpinnerRef = useRef<HTMLDivElement>(null);
    // Closes an open pull gap at once; called when a route commits.
    const closePullRef = useRef<(() => void) | null>(null);
    const scrollContext = useMemo(() => ({ scrollRef: scrollContainerRef }), []);
    const lastRootTabRef = useRef<string>(homePath);

    useStandaloneViewportHeight();

    const navigate = useCallback(
        (path: string) => {
            // Tapping the tab you are on returns to the top, as native tab bars do.
            if (path === pathname) {
                scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                return;
            }
            // A second tap on a screen still loading is the same navigation.
            if (path === router.state.location.pathname) return;
            router.history.push(path);
        },
        [pathname, router],
    );

    // The bar follows the router: started before a new path loads, ended once it renders.
    useEffect(() => {
        const offStart = router.subscribe("onBeforeNavigate", (event) => {
            if (event.pathChanged) navProgress.start();
        });
        const offEnd = router.subscribe("onResolved", () => {
            closePullRef.current?.();
            navProgress.committed();
        });
        return () => {
            offStart();
            offEnd();
        };
    }, [router]);

    // A fresh open is a navigation too; `ready` stands in for the commit.
    useEffect(() => {
        navProgress.start();
    }, []);

    useEffect(() => {
        if (ready) navProgress.committed();
    }, [ready]);

    useEffect(() => {
        if (rootTabPaths.includes(pathname)) lastRootTabRef.current = pathname;
    }, [pathname, rootTabPaths]);

    const resolvedTabs = tabs.map((tab) =>
        tab.variant && navPath.includes(tab.variant.pathContains)
            ? { ...tab, labelKey: tab.variant.labelKey, icon: tab.variant.icon }
            : tab,
    );

    const title = route ? t(route.titleKey) : "";
    const currentIsSubPage = isSubPage(route);
    const footerCtaLabel = route?.footerCtaKey ? t(route.footerCtaKey) : undefined;
    const showAccountIcon = !!onAccount && rootTabPaths.includes(pathname);

    // Back unwinds our history, else replaces with the parent: history only shrinks.
    const parent = route?.parent;
    const goBack = useCallback(() => {
        if (canGoBack) return router.history.back();
        const parentPath = !parent
            ? homePath
            : parent === "lastRootTab"
              ? lastRootTabRef.current
              : parent.startsWith(".")
                ? up(router.state.location.pathname, parent)
                : parent;
        router.history.replace(parentPath);
    }, [canGoBack, parent, homePath, router]);

    // Refetch what is on screen, in place: never a reload, so the POS cart survives.
    const onRefresh = useCallback(
        () => queryClient.refetchQueries({ type: "active" }),
        [queryClient],
    );

    // The pull gesture attaches once, so it reads current values from a ref.
    const refreshable = route?.refreshable ?? false;
    const pullRef = useRef({ refreshable, onRefresh });
    useEffect(() => {
        pullRef.current = { refreshable, onRefresh };
    }, [refreshable, onRefresh]);

    /**
     * Pull to refresh: the content slides down to reveal a spinner; let go past
     * the threshold and it holds while the app refetches. Only the finger-following
     * write is JavaScript (once a frame, passive listeners, no React state); the
     * rest is CSS. At rest the transform is cleared so fixed elements behave.
     */
    useEffect(() => {
        const scroller = scrollContainerRef.current;
        const spinner = pullSpinnerRef.current;
        const arc = spinner?.querySelector("circle");
        const dial = arc?.ownerSVGElement;
        const arrowhead = spinner?.querySelector(".pull-arrowhead");
        if (!scroller || !spinner || !arc || !dial || !arrowhead) return;

        let phase: "idle" | "pulling" | "holding" | "closing" = "idle";
        let armed = false;
        let ready = false;
        let startX = 0;
        let startY = 0;
        let distance = 0;
        let frame = 0;
        let timer: ReturnType<typeof setTimeout> | undefined;
        // Bumped when a gap is abandoned, so a late refresh cannot close a newer one.
        let token = 0;

        const paint = () => {
            frame = 0;
            if (phase !== "pulling") return;
            const progress = Math.min(distance / PULL_THRESHOLD_PX, 1);
            scroller.style.transform = `translate3d(0, ${distance}px, 0)`;
            spinner.style.opacity = String(progress);
            spinner.style.transform = `scale(${ready ? 1.1 : 0.6 + progress * 0.4})`;
            dial.style.transform = `rotate(${-90 + progress * 180}deg)`;
            // The arrowhead rides the arc's end: 270° at a full (three-quarter) arc.
            arrowhead.setAttribute("transform", `rotate(${progress * 270} 12 12)`);
            arc.style.strokeDashoffset = String(100 - progress * 75);
        };

        // Back to an ordinary element.
        const clear = () => {
            phase = "idle";
            scroller.style.transform = "";
            scroller.style.transition = "";
            scroller.style.willChange = "";
        };

        const slideTo = (y: number, easing: string, ms: number) => {
            scroller.style.transition = `transform ${ms}ms ${easing}`;
            scroller.style.transform = `translate3d(0, ${y}px, 0)`;
        };

        // `keepSpinning`: after a refresh it fades while still turning; stopping first made it visibly flip.
        const hideSpinner = (keepSpinning = false) => {
            spinner.dataset.state = keepSpinning ? "leaving" : "";
            spinner.style.opacity = "";
            spinner.style.transform = "";
            dial.style.transform = "";
        };

        const slideClosed = () => {
            // Any spinner is fully faded by now, so its spin can stop unseen.
            spinner.dataset.state = "";
            slideTo(0, "cubic-bezier(0.2, 0, 0, 1)", PULL_CLOSE_MS);
            // A timer rather than transitionend: a slide from 0 to 0 never fires one.
            timer = setTimeout(clear, PULL_CLOSE_MS + 20);
        };

        // After a refresh the spinner fades out before the content rises; a cancelled pull closes at once.
        const close = (afterSpinner = false) => {
            clearTimeout(timer);
            phase = "closing";
            hideSpinner(afterSpinner);
            if (afterSpinner) timer = setTimeout(slideClosed, PULL_SPINNER_FADE_MS);
            else slideClosed();
        };

        closePullRef.current = () => {
            if (phase === "idle") return;
            token += 1;
            armed = false;
            cancelAnimationFrame(frame);
            frame = 0;
            clearTimeout(timer);
            hideSpinner();
            clear();
        };

        const onTouchStart = (event: TouchEvent) => {
            // Cheapest first: scrollTop forces layout and must not run mid-navigation.
            armed =
                phase === "idle" &&
                event.touches.length === 1 &&
                pullRef.current.refreshable &&
                !navProgress.isBusy() &&
                scroller.scrollTop <= 0;
            if (!armed) return;
            startX = event.touches[0]!.clientX;
            startY = event.touches[0]!.clientY;
        };

        const onTouchMove = (event: TouchEvent) => {
            if (!armed) return;
            const dx = event.touches[0]!.clientX - startX;
            const dy = event.touches[0]!.clientY - startY;
            if (phase !== "pulling") {
                if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
                // The first real movement decides: sideways or upwards is not a pull.
                if (Math.abs(dx) > Math.abs(dy) || dy < 0) {
                    armed = false;
                    return;
                }
                phase = "pulling";
                ready = false;
                spinner.dataset.state = "pulling";
                scroller.style.transition = "none";
                scroller.style.willChange = "transform";
            }
            // Resistance grows with distance, never past the cap.
            distance = PULL_MAX_PX * (1 - Math.exp(-Math.max(dy, 0) / PULL_STIFFNESS_PX));
            const nowReady = distance >= PULL_THRESHOLD_PX;
            // A short tick on crossing the threshold (no vibration on iOS; the scale pop is the cue).
            if (nowReady && !ready && "vibrate" in navigator) navigator.vibrate(10);
            ready = nowReady;
            if (!frame) frame = requestAnimationFrame(paint);
        };

        const release = (refresh: boolean) => {
            if (!armed) return;
            armed = false;
            if (phase !== "pulling") return;
            cancelAnimationFrame(frame);
            frame = 0;
            const onRefreshNow = pullRef.current.onRefresh;
            if (!refresh || !ready || !onRefreshNow) {
                close();
                return;
            }

            phase = "holding";
            const mine = ++token;
            const startedAt = performance.now();
            spinner.style.opacity = "";
            spinner.style.transform = "";
            dial.style.transform = "";
            arc.style.strokeDashoffset = "25";
            spinner.dataset.state = "spinning";
            const spring = window.matchMedia("(prefers-reduced-motion: reduce)").matches
                ? "ease-out"
                : "cubic-bezier(0.34, 1.4, 0.64, 1)";
            slideTo(PULL_HOLD_PX, spring, 360);

            // A pull too soon after the last animates the same but fetches nothing.
            const fetching = refreshGate.shouldFetch();
            if (fetching) refreshGate.mark();
            // A failed refresh leaves the old data on screen.
            const refreshing = fetching
                ? Promise.resolve()
                      .then(onRefreshNow)
                      .catch(() => {})
                : Promise.resolve();
            navProgress.run(refreshing);
            refreshing.then(() => {
                const wait = PULL_MIN_SPIN_MS - (performance.now() - startedAt);
                timer = setTimeout(
                    () => {
                        if (mine === token) close(true);
                    },
                    Math.max(0, wait),
                );
            });
        };
        const onTouchEnd = () => release(true);
        const onTouchCancel = () => release(false);

        scroller.addEventListener("touchstart", onTouchStart, { passive: true });
        scroller.addEventListener("touchmove", onTouchMove, { passive: true });
        scroller.addEventListener("touchend", onTouchEnd, { passive: true });
        scroller.addEventListener("touchcancel", onTouchCancel, { passive: true });
        return () => {
            cancelAnimationFrame(frame);
            clearTimeout(timer);
            closePullRef.current = null;
            scroller.removeEventListener("touchstart", onTouchStart);
            scroller.removeEventListener("touchmove", onTouchMove);
            scroller.removeEventListener("touchend", onTouchEnd);
            scroller.removeEventListener("touchcancel", onTouchCancel);
            hideSpinner();
            clear();
        };
    }, []);

    // Routes override the bottom padding (pb-0 for full-bleed content).
    const scrollPaddingBottom = route?.scrollPaddingBottom ?? "";

    return (
        <ScrollContext value={scrollContext}>
            <FooterSlotContext value={footerSlotEl}>
                <HeaderSlotContext value={headerSlotEl}>
                    <HeaderTitleSlotContext value={titleSlotEl}>
                        {/* svh in a tab (no resize as the URL bar moves); installed, the measured --shell-height. */}
                        <div className="h-[100svh] [@media(display-mode:standalone)]:h-[var(--shell-height,100dvh)] flex flex-col bg-gradient-to-b from-slate-100 to-slate-200 overflow-hidden pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
                            <MobileHeader
                                title={title}
                                isSubPage={currentIsSubPage}
                                close={route?.close ?? false}
                                avatarUrl={avatarUrl ?? null}
                                showAccountIcon={showAccountIcon}
                                onBack={goBack}
                                onAccount={onAccount}
                                actionsRef={setHeaderSlotEl}
                                titleRef={setTitleSlotEl}
                            />

                            {/* Always mounted; navProgress drives it, never React. Inside the header's bottom edge, so outside main's clip. */}
                            <div className="relative h-0 shrink-0">
                                <div ref={attachBar} className="nav-progress" aria-hidden>
                                    <span className="crawl" />
                                </div>
                            </div>

                            {/* min-h-0 lets it shrink and scroll; overflow-hidden clips content pushed down by a pull. */}
                            <main className="flex-1 min-h-0 relative overflow-hidden">
                                {/* Behind the scroll container: sliding the content down uncovers it. */}
                                <div
                                    ref={pullSpinnerRef}
                                    className="pull-spinner text-brand"
                                    aria-hidden
                                >
                                    <svg
                                        viewBox="0 0 24 24"
                                        width="24"
                                        height="24"
                                        overflow="visible"
                                    >
                                        <circle
                                            cx="12"
                                            cy="12"
                                            r="9"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2.5"
                                            strokeLinecap="round"
                                            pathLength={100}
                                            strokeDasharray={100}
                                            strokeDashoffset={100}
                                        />
                                        {/* Starts at the arc's start; the gesture rotates it to the end. */}
                                        <path
                                            className="pull-arrowhead"
                                            d="M15.8 12 L26.2 12 L21 18 Z"
                                            fill="currentColor"
                                            transform="rotate(0 12 12)"
                                        />
                                    </svg>
                                </div>
                                <div
                                    ref={scrollContainerRef}
                                    id="shell-scroll"
                                    data-scroll-restoration-id="shell"
                                    // No native bounce where a pull moves the content (iOS would move it twice).
                                    className={`absolute inset-0 overflow-y-auto p-4 pt-2 ${scrollPaddingBottom} ${refreshable ? "overscroll-y-none" : ""}`}
                                >
                                    {ready && <Outlet />}
                                </div>
                            </main>

                            {/* Page slot, route CTA, then tabs; white only when something is in it. */}
                            <footer
                                className={`shrink-0 ${currentIsSubPage ? "pb-[calc(env(safe-area-inset-bottom)*0.75)]" : "pb-[env(safe-area-inset-bottom)]"} [&:has(>:not(:empty))]:bg-white [&:has(>.is-occupied)]:bg-white`}
                            >
                                <div ref={setFooterSlotEl} />
                                {footerCtaLabel && (
                                    <div className="bg-white border-t border-gray-200 px-4 py-3">
                                        <button
                                            onClick={() => navigate(`${pathname}/add`)}
                                            className="w-full bg-brand text-white py-4 rounded-xl font-semibold text-base active:scale-[0.98] transition-transform"
                                        >
                                            {footerCtaLabel}
                                        </button>
                                    </div>
                                )}
                                {!currentIsSubPage && tabs.length > 0 && (
                                    <MobileFooterNav
                                        tabs={resolvedTabs}
                                        currentPath={navPath}
                                        onTabClick={navigate}
                                    />
                                )}
                            </footer>

                            {extras}
                        </div>

                        <RefreshSheet />
                        {overlay}
                    </HeaderTitleSlotContext>
                </HeaderSlotContext>
            </FooterSlotContext>
        </ScrollContext>
    );
}

/** A parent relative to the screen (`..` is one level up), as a path with no trailing slash. */
function up(pathname: string, relative: string): string {
    return new URL(relative, `https://app${pathname}/`).pathname.replace(/\/$/, "") || "/";
}
