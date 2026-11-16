import { fakeView } from "./fake";

/**
 * The measuring engine (task 073): what the phone reports about the screen, read every frame,
 * never from a single event. Events only start a run; the numbers come from the frames after.
 */

/** One frame's reading. Heights and tops in CSS px, `t` in ms since the run started. */
export interface Sample {
    t: number;
    /** The page's height: shrinks with the keyboard only where the page resizes (Android). */
    page: number;
    /** What is visible: shrinks with any keyboard. */
    visible: number;
    /** How far the visible area slid down the page (the iPhone's pan). */
    offset: number;
    scale: number;
    scrollY: number;
    width: number;
    /** The app's frame and header, from the top of what is seen. */
    frameTop: number;
    frameHeight: number;
    headerTop: number;
    /** Android's own report of the keyboard's height, where it gives one. */
    keyboard: number;
    focused: boolean;
    /** The focused field's bottom, from the top of what is seen; 0 without one. */
    fieldBottom: number;
}

type VirtualKeyboard = { boundingRect: DOMRect };

/**
 * How far the visible area slid that a box's own position does not already show. The iPhone
 * (iOS 18, installed) reports one slide twice, as the page's scroll and as the visible area's
 * offset, and a box's position already includes the scroll: subtracting both counted it twice
 * (the owner's first report: the header "moved 760 px" for a 380 px keyboard).
 */
export function slidBeyondScroll(offsetTop: number, scrollY: number): number {
    return Math.max(0, offsetTop - scrollY);
}

export function readSample(t: number): Sample {
    const root = document.documentElement;
    const vv = window.visualViewport;
    const frame = document.getElementById("shell-scroll")?.closest("main")?.parentElement;
    const frameBox = frame?.getBoundingClientRect();
    const header = frame?.querySelector("header")?.getBoundingClientRect();
    const vk = (navigator as Navigator & { virtualKeyboard?: VirtualKeyboard }).virtualKeyboard;
    const el = document.activeElement;
    // Where things are on the glass: the iPhone's pan moves what is seen, not the page's boxes.
    const slid = slidBeyondScroll(vv?.offsetTop ?? 0, window.scrollY);
    return {
        t: Math.round(t),
        page: root.clientHeight - fakeView.shrink,
        visible: (vv?.height ?? window.innerHeight) - fakeView.covered,
        offset: slid + fakeView.pan,
        scale: vv?.scale ?? 1,
        scrollY: window.scrollY,
        width: root.clientWidth,
        frameTop: Math.round((frameBox?.top ?? 0) - slid),
        frameHeight: Math.round(frameBox?.height ?? 0),
        headerTop: Math.round((header?.top ?? 0) - slid),
        keyboard: Math.round(vk?.boundingRect.height ?? 0),
        fieldBottom:
            el instanceof HTMLElement && el !== document.body
                ? Math.round(el.getBoundingClientRect().bottom - slid)
                : 0,
        focused:
            el instanceof HTMLTextAreaElement ||
            (el instanceof HTMLInputElement && el.type !== "file" && el.type !== "button") ||
            (el instanceof HTMLElement && el.isContentEditable),
    };
}

const same = (a: Sample, b: Sample) =>
    a.page === b.page &&
    a.visible === b.visible &&
    a.offset === b.offset &&
    a.scale === b.scale &&
    a.scrollY === b.scrollY &&
    a.width === b.width &&
    a.frameTop === b.frameTop &&
    a.frameHeight === b.frameHeight &&
    a.headerTop === b.headerTop &&
    a.keyboard === b.keyboard &&
    a.focused === b.focused &&
    a.fieldBottom === b.fieldBottom;

/** Unchanged this long: the phone has settled. */
export const SETTLE_MS = 300;

/**
 * Records every frame that differs from the one before, from `start()` until `stop()`. A run of
 * a lab case lasts as long as the case; `settled()` waits for the phone to stop moving.
 */
export class Recorder {
    samples: Sample[] = [];
    private t0 = 0;
    private frame = 0;
    private lastChange = 0;

    start() {
        this.t0 = performance.now();
        this.samples = [readSample(0)];
        this.lastChange = this.t0;
        const step = () => {
            const now = performance.now();
            const s = readSample(now - this.t0);
            if (!same(s, this.samples.at(-1)!)) {
                this.samples.push(s);
                this.lastChange = now;
            }
            this.frame = requestAnimationFrame(step);
        };
        this.frame = requestAnimationFrame(step);
    }

    stop(): Sample[] {
        cancelAnimationFrame(this.frame);
        return this.samples;
    }

    /**
     * Resolves once nothing has changed for SETTLE_MS, but not before `min` ms (a keyboard starts
     * closing a moment after the tap), and after `max` ms whatever happens.
     */
    settled(min = 800, max = 3000): Promise<void> {
        const from = performance.now();
        const until = from + max;
        return new Promise((resolve) => {
            const check = () => {
                const now = performance.now();
                const quiet = now - from >= min && now - this.lastChange >= SETTLE_MS;
                if (quiet || now >= until) resolve();
                else setTimeout(check, 50);
            };
            check();
        });
    }
}
