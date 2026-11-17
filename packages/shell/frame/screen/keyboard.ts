import { useEffect } from "react";

import { fakeUnslide, fakeView, onFakeChange } from "./fake";

/**
 * The keyboard (RFC: The keyboard (v2), task 073). Two kinds of phone:
 *
 * - The page shrinks with the keyboard (Android `resizes-content`, Safari 27.3, an old Chrome):
 *   the browser does the work; this only marks `data-keyboard` so the tab bar steps aside
 * - The page keeps its size and the keyboard covers it (the iPhone before Safari 27.3, an Android
 *   browser that only covers): iOS scrolls the whole document to show the field, header and all.
 *   In the same event that reports the keyboard, before the frame is drawn, the app's frame takes
 *   the visible height (`data-keyboard-fit`) and the document's scroll goes back to 0, so the
 *   header stays and the bottom box sits on the keyboard; a field the smaller frame would hide is
 *   scrolled into view inside the content
 */

/** Less than this is a toolbar, not a keyboard. */
const MIN_KEYBOARD = 120;
/** The frame follows the keyboard's slide (globals.css, `[data-keyboard-fit]`). */
const FIT_MS = 250;
/** Room under a revealed field. */
const MARGIN = 12;

const SKIP = new Set([
    "checkbox",
    "radio",
    "button",
    "submit",
    "reset",
    "file",
    "range",
    "color",
    "hidden",
    "image",
]);

function typing(): boolean {
    const el = document.activeElement;
    if (!(el instanceof HTMLElement)) return false;
    if (el.isContentEditable) return true;
    if (el instanceof HTMLTextAreaElement) return !el.readOnly;
    return el instanceof HTMLInputElement && !el.readOnly && !SKIP.has(el.type);
}

const frameEl = () => document.querySelector<HTMLElement>(".shell-frame");

/** The document never scrolls in the app: only its content does. */
function unslide() {
    const vv = window.visualViewport;
    // iOS also pans the visible area to centre a field below the middle (offset, not scroll).
    const panned = !!vv && vv.scale <= 1.01 && vv.offsetTop > 1;
    if (window.scrollY !== 0 || window.scrollX !== 0 || panned) window.scrollTo(0, 0);
    fakeUnslide();
}

/** Scrolls the focused field into view inside the content, for a frame `height` tall. */
function reveal(height: number, after: number) {
    const field = document.activeElement;
    const frame = frameEl();
    const scroller =
        field instanceof HTMLElement ? field.closest<HTMLElement>("#shell-scroll") : null;
    if (!frame || !scroller || !(field instanceof HTMLElement)) return;
    const go = () => {
        const f = frame.getBoundingClientRect();
        const s = scroller.getBoundingClientRect();
        // What sits under the content (a footer) keeps its height as the frame shrinks.
        const bottom = f.top + height - (f.bottom - s.bottom);
        const r = field.getBoundingClientRect();
        const by =
            r.bottom + MARGIN > bottom
                ? r.bottom + MARGIN - bottom
                : Math.min(0, r.top - s.top - MARGIN);
        if (Math.abs(by) < 1) return false;
        const target = scroller.scrollTop + by;
        // Not reachable yet while the frame is still tall: after the slide instead.
        if (target > scroller.scrollHeight - scroller.clientHeight + 1) return false;
        scroller.scrollTo({ top: target, behavior: "smooth" });
        return true;
    };
    if (!go() && after) setTimeout(go, after);
}

export function useKeyboardState() {
    useEffect(() => {
        const root = document.documentElement;
        const vv = window.visualViewport;
        let width = 0;
        let page = 0;
        let seen = 0;
        let fitted = 0;
        let field: Element | null = null;
        let closing: ReturnType<typeof setTimeout> | undefined;

        const visible = () => (vv?.height ?? window.innerHeight) - fakeView.covered;

        const fit = (height: number) => {
            clearTimeout(closing);
            const opening = root.dataset.keyboardFit !== "open";
            const moved = document.activeElement !== field;
            field = document.activeElement;
            root.dataset.keyboardFit = "open";
            if (fitted !== height) root.style.setProperty("--keyboard-fit", `${height}px`);
            fitted = height;
            unslide();
            if (opening || moved) reveal(height, opening ? FIT_MS + 50 : 0);
        };

        const unfit = () => {
            if (root.dataset.keyboardFit !== "open") return;
            field = null;
            fitted = 0;
            // Back to its own height, sliding with the keyboard.
            root.dataset.keyboardFit = "closing";
            root.style.removeProperty("--keyboard-fit");
            unslide();
            clearTimeout(closing);
            closing = setTimeout(() => delete root.dataset.keyboardFit, FIT_MS + 50);
        };

        const run = () => {
            const h = root.clientHeight - fakeView.shrink;
            const v = Math.round(visible());
            if (root.clientWidth !== width) {
                width = root.clientWidth;
                page = h;
                seen = v;
            }
            const on = typing();
            // The heights without a keyboard: whenever nobody is typing.
            if (!on) {
                page = h;
                seen = v;
            }
            const zoomed = (vv?.scale ?? 1) > 1.01;
            const shrank = on && page - h > MIN_KEYBOARD;
            const covered = on && !shrank && !zoomed && seen - v > MIN_KEYBOARD;
            if (shrank || covered) root.dataset.keyboard = "open";
            else delete root.dataset.keyboard;
            if (covered) fit(v);
            else unfit();
        };
        const onScroll = () => {
            if (root.dataset.keyboardFit) unslide();
        };

        onFakeChange(run);
        // Focus moves before the page resizes, and the other way round: measure after either.
        const later = () => setTimeout(run, 0);
        run();
        window.addEventListener("resize", run);
        vv?.addEventListener("resize", run);
        vv?.addEventListener("scroll", run);
        window.addEventListener("scroll", onScroll, { passive: true });
        document.addEventListener("focusin", later);
        document.addEventListener("focusout", later);
        return () => {
            onFakeChange(() => {});
            clearTimeout(closing);
            window.removeEventListener("resize", run);
            vv?.removeEventListener("resize", run);
            vv?.removeEventListener("scroll", run);
            window.removeEventListener("scroll", onScroll);
            document.removeEventListener("focusin", later);
            document.removeEventListener("focusout", later);
            delete root.dataset.keyboard;
            delete root.dataset.keyboardFit;
            root.style.removeProperty("--keyboard-fit");
        };
    }, []);
}
