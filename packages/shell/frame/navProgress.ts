// The navigation progress bar, outside React so the shell never re-renders for it.
// idle → loading (until the route commits) → landing (until first requests answer
// and the page is on screen) → done (fill, pulse, fade) → idle. Every wait is capped.

type State = "idle" | "loading" | "landing" | "done";

const LOADING_CAP_MS = 15_000;
const LANDING_CAP_MS = 4_000;
/** Reduced motion has no animationend to end `done`. */
const DONE_CAP_MS = 1_500;
/** A hidden tab never paints; stop waiting for frames after this. */
const PAINT_WAIT_MAX_MS = 400;
/** Unbroken frames needed after a commit before the bar ends. */
const QUIET_MS = 200;
/** One crossing of the short bar (nav-progress.css); it is centred halfway through. */
const LOOP_MS = 1100;
/** Past the centre by more than this, stopping there would show. */
const LATE_MS = 60;
/** A frame gap longer than this means the browser drew nothing. */
const FRAME_GAP_MS = 100;

let bar: HTMLElement | null = null;
let state: State = "idle";
/** Landing and done caps — sequential, so one slot. */
let cap: ReturnType<typeof setTimeout> | undefined;
/** Loading cap. Its own slot so later navigations can't keep resetting it. */
let watchdog: ReturnType<typeof setTimeout> | undefined;
let settleFrame = 0;
let cancelPaint = () => {};
/** First-load requests in flight, per run. */
let pending = 0;
/** Bumped per run so a late request can't count against the next one. */
let generation = 0;

const isRunning = () => state === "loading" || state === "landing";

function cancelWaits() {
    cancelAnimationFrame(settleFrame);
    cancelPaint();
}

/** Runs `fn` once a frame has painted (two nested frames prove it), or after a cap in a hidden tab. */
export function whenPainted(fn: () => void): () => void {
    let frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(done);
    });
    const timer = setTimeout(done, PAINT_WAIT_MAX_MS);
    function cancel() {
        cancelAnimationFrame(frame);
        clearTimeout(timer);
    }
    function done() {
        cancel();
        fn();
    }
    return cancel;
}

function setState(next: State) {
    if (state === next) return;
    const previous = state;
    state = next;
    if (!bar) return;
    bar.dataset.state = next;
    drive(previous, next);
    const page = document.getElementById("shell-scroll");
    if (isRunning()) page?.setAttribute("aria-busy", "true");
    else page?.removeAttribute("aria-busy");
}

function armCap(ms: number, onExpire: () => void) {
    clearTimeout(cap);
    cap = setTimeout(onExpire, ms);
}

/** The bar's animations. Empty under reduced motion; callers skip missing ones. */
function animations() {
    const all = bar?.getAnimations({ subtree: true }) ?? [];
    const named = (name: string) => all.find((a) => (a as CSSAnimation).animationName === name);
    return {
        crawl: named("nav-crawl"),
        fill: named("nav-fill"),
        settle: named("nav-settle"),
    };
}

// Animations are only played and paused, never created mid-navigation (on a slow
// phone a new one froze), and only from here (mixing with CSS made WebKit replay them).
function drive(previous: State, next: State) {
    const { crawl, fill, settle } = animations();
    const fresh = next === "loading" && (previous === "idle" || previous === "done");
    if (next === "idle" || fresh) {
        // Parked at zero: off-screen, and drawing nothing.
        for (const animation of [crawl, fill, settle]) {
            if (!animation) continue;
            animation.pause();
            animation.currentTime = 0;
        }
    }
    if (fresh) {
        crawl?.play();
    } else if (next === "done") {
        // Timed to arrive here; a late timer is put right, too small to see.
        if (crawl) {
            crawl.pause();
            crawl.currentTime = LOOP_MS / 2;
        }
        fill?.play();
        settle?.play();
    }
}

/** Ms until the short bar is next centred; 0 without one (reduced motion). */
function untilCentred(): number {
    const time = Number(animations().crawl?.currentTime ?? NaN);
    return Number.isNaN(time) ? 0 : (LOOP_MS / 2 - (time % LOOP_MS) + LOOP_MS) % LOOP_MS;
}

/** Ends the run once a frame has painted and the short bar reaches the centre, so the ending is seen. */
function finish() {
    cancelWaits();
    const end = () => {
        clearTimeout(watchdog);
        setState("done");
        armCap(DONE_CAP_MS, () => setState("idle"));
    };
    const wait = (again: boolean) => {
        const timer = setTimeout(() => {
            // A busy phone woke this late: one more crossing rather than a visible jump back.
            if (again && LOOP_MS - untilCentred() > LATE_MS) wait(false);
            else end();
        }, untilCentred());
        cancelPaint = () => clearTimeout(timer);
    };
    cancelPaint = whenPainted(() => wait(true));
}

/** Enters loading. A running bar keeps its crawl; a settled one restarts. */
function begin() {
    cancelWaits();
    clearTimeout(cap); // the old run's cap must not fire into this one
    generation += 1;
    pending = 0;
    if (!isRunning()) {
        clearTimeout(watchdog);
        watchdog = setTimeout(() => {
            if (import.meta.env.DEV) {
                console.warn(
                    "[navProgress] no commit within 15s — a navigation path is missing its signal",
                );
            }
            finish();
        }, LOADING_CAP_MS);
    }
    setState("loading");
}

/** Finishes after `QUIET_MS` of unbroken frames: once the page is on screen, not merely committed. */
function settleWhenQuiet() {
    cancelAnimationFrame(settleFrame);
    let streakFrom = 0;
    let previous = -Infinity;
    const tick = (now: number) => {
        if (state !== "landing" || pending > 0) return; // `track` restarts it
        if (now - previous > FRAME_GAP_MS) streakFrom = now;
        previous = now;
        if (now - streakFrom >= QUIET_MS) finish();
        else settleFrame = requestAnimationFrame(tick);
    };
    settleFrame = requestAnimationFrame(tick);
}

function onAnimationEnd(event: AnimationEvent) {
    if (event.animationName !== "nav-settle" || state !== "done") return;
    clearTimeout(cap);
    setState("idle");
}

export const navProgress = {
    /** Ref callback for the bar. Stable, so React attaches it once. */
    attach(node: HTMLElement | null) {
        if (!node) return;
        bar = node;
        node.dataset.state = state;
        if (isRunning()) drive("idle", "loading"); // mounted mid-run
        node.addEventListener("animationend", onAnimationEnd);
        return () => {
            node.removeEventListener("animationend", onAnimationEnd);
            if (bar === node) bar = null;
        };
    },

    /** A navigation has begun: the router is about to load it. */
    start: begin,

    /** The route has committed: the router resolved it. */
    committed() {
        if (state !== "loading") return;
        setState("landing");
        armCap(LANDING_CAP_MS, finish);
        settleWhenQuiet();
    },

    /** Holds the bar in landing until a first-load request settles. Ignored at rest, so polling never starts it. */
    track<T>(promise: Promise<T>): Promise<T> {
        if (!isRunning()) return promise;
        const counted = generation;
        pending += 1;
        return promise.finally(() => {
            if (counted !== generation) return;
            pending -= 1;
            if (state === "landing" && pending === 0) settleWhenQuiet();
        });
    },

    /** Runs the bar for a refresh. A navigation started meanwhile takes the bar over. */
    run(promise: Promise<unknown>) {
        begin();
        const counted = generation;
        const settle = () => {
            if (counted === generation && state === "loading") finish();
        };
        promise.then(settle, settle);
    },

    /** A navigation or refresh is in flight. A finishing bar does not count. */
    isBusy: isRunning,
};
