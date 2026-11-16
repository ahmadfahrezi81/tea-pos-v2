import { useEffect } from "react";

/**
 * Whether the keyboard is open, as the browser shows it: nothing here moves anything (RFC: The
 * keyboard (v2)). The browser does the work (`interactive-widget=resizes-content`: the page
 * shrinks, the column reflows); this only marks `data-keyboard` on the page while it has, so the
 * tab bar can step aside. A phone whose page does not shrink (the iPhone before Safari 27.3, a
 * floating or hardware keyboard, an old Chrome) is never marked: nothing changes there.
 */

/** Shrinking by less than this is a toolbar, not a keyboard. */
const MIN_KEYBOARD = 120;

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

/** The dev server's fake keyboard (`?preview=keyboard`): how much of the page it takes. */
let fake = 0;
let measure = () => {};

export function setFakeKeyboard(px: number) {
    fake = px;
    document.documentElement.style.setProperty("--fake-keyboard", `${px}px`);
    measure();
}

export function useKeyboardState() {
    useEffect(() => {
        const root = document.documentElement;
        let width = 0;
        let full = 0;
        const run = () => {
            const h = root.clientHeight - fake;
            if (root.clientWidth !== width) {
                width = root.clientWidth;
                full = h;
            }
            // The page's height without a keyboard: whenever nobody is typing.
            if (!typing()) full = h;
            const open = typing() && full - h > MIN_KEYBOARD;
            if (open) root.dataset.keyboard = "open";
            else delete root.dataset.keyboard;
        };
        measure = run;
        // Focus moves before the page resizes, and the other way round: measure after either.
        const later = () => setTimeout(run, 0);
        run();
        window.addEventListener("resize", run);
        document.addEventListener("focusin", later);
        document.addEventListener("focusout", later);
        return () => {
            measure = () => {};
            window.removeEventListener("resize", run);
            document.removeEventListener("focusin", later);
            document.removeEventListener("focusout", later);
            delete root.dataset.keyboard;
        };
    }, []);
}
