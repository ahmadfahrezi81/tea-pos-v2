import { useEffect, type RefObject } from "react";

/**
 * The keyboard, one way for every field (task 072), as the native apps: the header never moves,
 * the tab bar stays where it is and the keyboard covers it, the screen's own bottom bar (chat's
 * box, a form's Save) rides on the keyboard, and the content gets that much room to scroll.
 *
 * The keyboard's height comes from `navigator.virtualKeyboard` on Android (the page no longer
 * resizes) and from `visualViewport` on the iPhone. The iPhone pans the whole page to show a
 * field the keyboard would cover; it does not when the field is already above it, so on a touch
 * the bar is lifted to this phone's last keyboard height before the field is focused.
 */

/** Less than this between the page and what is visible is a toolbar, not a keyboard. */
const MIN_KEYBOARD = 120;
/** A field's tap: lift before the focus; a drag past this is a scroll, and the lift is undone. */
const DRAG_PX = 10;
/** The iPhone told nothing of a keyboard this long after a focus: there is none (a hardware one). */
const NO_KEYBOARD_MS = 800;
/** Room kept between a field and the keyboard when we scroll it into view. */
const GAP = 16;
const SAVED = "tea-pos:keyboard";

const ios =
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

type VirtualKeyboard = EventTarget & { overlaysContent: boolean; boundingRect: DOMRect };
const virtualKeyboard = (navigator as Navigator & { virtualKeyboard?: VirtualKeyboard })
    .virtualKeyboard;

function typable(el: EventTarget | null): el is HTMLElement {
    if (!(el instanceof HTMLElement)) return false;
    if (el.isContentEditable) return true;
    if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled;
    if (!(el instanceof HTMLInputElement) || el.readOnly || el.disabled) return false;
    return ![
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
    ].includes(el.type);
}

function savedHeight(): number {
    try {
        const n = Number(localStorage.getItem(`${SAVED}:${screen.height}`));
        if (n > MIN_KEYBOARD) return n;
    } catch {
        // Storage refused: guess.
    }
    // An iPhone's keyboard with its suggestions row is about 40% of the screen.
    return Math.round(window.innerHeight * 0.4);
}

function saveHeight(n: number) {
    try {
        localStorage.setItem(`${SAVED}:${screen.height}`, String(Math.round(n)));
    } catch {
        // Next time it guesses again.
    }
}

export function useKeyboard({
    footer,
    slot,
    scroller,
}: {
    footer: RefObject<HTMLElement | null>;
    slot: HTMLElement | null;
    scroller: RefObject<HTMLElement | null>;
}) {
    useEffect(() => {
        const root = document.documentElement;
        let height = 0;
        let pinFrame = 0;
        let noKeyboard = 0;
        let touch: { x: number; y: number; lifted: boolean } | null = null;

        /** What the keyboard covers of the footer below the bar: the tabs, the safe area. */
        const underBar = () => {
            const f = footer.current;
            if (!f) return 0;
            if (!slot) return f.offsetHeight;
            return f.offsetHeight - (slot.offsetTop + slot.offsetHeight);
        };

        /** Keeps a chat at its newest message while the room under it changes. */
        const pinWhile = (el: HTMLElement) => {
            cancelAnimationFrame(pinFrame);
            const until = performance.now() + 350;
            const step = () => {
                el.scrollTop = el.scrollHeight;
                if (performance.now() < until) pinFrame = requestAnimationFrame(step);
            };
            step();
        };

        /** The focused field, if the keyboard would cover it, scrolled just above it. */
        const reveal = (field: Element | null, behavior: ScrollBehavior) => {
            const el = scroller.current;
            if (!el || !field || !el.contains(field) || slot?.contains(field)) return;
            const visibleBottom = root.clientHeight - height - (slot?.offsetHeight ?? 0) - GAP;
            const over = field.getBoundingClientRect().bottom - visibleBottom;
            if (over > 0) el.scrollBy({ top: over, behavior });
        };

        const set = (next: number, behavior: ScrollBehavior = "smooth") => {
            next = next > MIN_KEYBOARD ? Math.round(next) : 0;
            if (next === height) return;
            const el = scroller.current;
            const atBottom = !!el && el.scrollHeight - el.scrollTop - el.clientHeight < 8;
            height = next;
            const lift = Math.max(0, height - underBar());
            root.style.setProperty("--keyboard-lift", `${lift}px`);
            if (height) root.dataset.keyboard = "open";
            else delete root.dataset.keyboard;
            if (el && atBottom) pinWhile(el);
            else if (height) reveal(document.activeElement, behavior);
        };

        const fromViewport = () => {
            const vv = window.visualViewport;
            if (!vv) return;
            const covered = root.clientHeight - vv.height;
            if (covered > MIN_KEYBOARD) {
                clearTimeout(noKeyboard);
                saveHeight(covered);
                set(covered);
            } else if (!typable(document.activeElement)) set(0);
        };

        // Android: the keyboard overlays the page, and tells us how tall it is.
        const onGeometry = () => set(virtualKeyboard!.boundingRect.height);
        if (virtualKeyboard) {
            virtualKeyboard.overlaysContent = true;
            virtualKeyboard.addEventListener("geometrychange", onGeometry);
        }

        // The iPhone: lift on the touch, before the focus, so iOS finds nothing to pan.
        const onTouchStart = (e: TouchEvent) => {
            if (!ios || height || !typable(e.target) || e.target === document.activeElement) return;
            const t = e.touches[0]!;
            touch = { x: t.clientX, y: t.clientY, lifted: true };
            // Quicker than the keyboard: the bar must be up when iOS looks, at the focus.
            root.dataset.keyboardFast = "";
            setTimeout(() => delete root.dataset.keyboardFast, 300);
            set(savedHeight(), "instant");
        };
        const onTouchMove = (e: TouchEvent) => {
            if (!touch?.lifted) return;
            const t = e.touches[0]!;
            if (Math.hypot(t.clientX - touch.x, t.clientY - touch.y) > DRAG_PX) {
                touch = null;
                if (!typable(document.activeElement)) set(0);
            }
        };
        const onFocusIn = (e: FocusEvent) => {
            touch = null;
            if (!ios || !typable(e.target)) return;
            if (!height) set(savedHeight());
            clearTimeout(noKeyboard);
            noKeyboard = window.setTimeout(() => {
                const vv = window.visualViewport;
                if (vv && root.clientHeight - vv.height < MIN_KEYBOARD) set(0);
            }, NO_KEYBOARD_MS);
        };
        // Leaving one field for another keeps the keyboard: wait a moment before lowering.
        const onFocusOut = () => {
            if (!ios) return;
            setTimeout(() => {
                if (!typable(document.activeElement)) set(0);
            }, 50);
        };

        window.visualViewport?.addEventListener("resize", fromViewport);
        document.addEventListener("touchstart", onTouchStart, { capture: true, passive: true });
        document.addEventListener("touchmove", onTouchMove, { capture: true, passive: true });
        document.addEventListener("focusin", onFocusIn);
        document.addEventListener("focusout", onFocusOut);
        return () => {
            cancelAnimationFrame(pinFrame);
            clearTimeout(noKeyboard);
            if (virtualKeyboard) {
                virtualKeyboard.overlaysContent = false;
                virtualKeyboard.removeEventListener("geometrychange", onGeometry);
            }
            window.visualViewport?.removeEventListener("resize", fromViewport);
            document.removeEventListener("touchstart", onTouchStart, { capture: true });
            document.removeEventListener("touchmove", onTouchMove, { capture: true });
            document.removeEventListener("focusin", onFocusIn);
            document.removeEventListener("focusout", onFocusOut);
            root.style.removeProperty("--keyboard-lift");
            delete root.dataset.keyboard;
        };
    }, [footer, slot, scroller]);
}
