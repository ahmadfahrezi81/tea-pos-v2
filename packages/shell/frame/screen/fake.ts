/**
 * Fake phone keyboards for the dev server (`?preview=keyboard` Android, `?preview=keyboard-ios`
 * the iPhone before Safari 27.3), so the screen's behaviour is tried on a laptop (task 073). Each
 * does what its phone does, as far as a page can show it:
 *
 * - Android (`resizes-content`): the page shrinks by the keyboard's height; nothing pans
 * - iPhone: the page keeps its size, the keyboard covers its bottom, and at focus the whole page
 *   slides up to bring a field lower than the middle of what stays visible to that middle; the
 *   shell's keyboard fit puts it back in the same moment, as on the phone (`fakeUnslide`)
 *
 * The measuring engine reads these numbers as it would read the phone's (`fakeView`). A fake,
 * not the phone: timing and the keyboard's exact height are the real phone's to confirm.
 */

export type FakeMode = "android" | "ios";

const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
const SKIP = [
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
];

/** What the fake takes away: the page's height (Android), the visible height and the slide (both). */
export const fakeView = { shrink: 0, covered: 0, pan: 0 };
let onChange = () => {};

/** The shell puts the page back, as `scrollTo(0, 0)` does on the phone. */
export function fakeUnslide() {
    if (!fakeView.pan) return;
    fakeView.pan = 0;
    document.body.style.transform = "";
}

/** The shell's keyboard state listens, to measure again. */
export function onFakeChange(listener: () => void) {
    onChange = listener;
}

const typable = (el: Element | null) =>
    el instanceof HTMLTextAreaElement ||
    (el instanceof HTMLInputElement && !SKIP.includes(el.type));

/** Which fake runs, if any: the shell's keyboard reads it as it would learn it on the phone. */
export let fakeMode: FakeMode | null = null;

export function startFakeKeyboard(mode: FakeMode) {
    fakeMode = mode;
    const root = document.documentElement;
    const pad = document.createElement("div");
    pad.setAttribute("aria-hidden", "true");
    pad.style.cssText =
        "position:fixed;left:0;right:0;bottom:0;z-index:2147483646;display:none;flex-direction:column;gap:8px;" +
        `padding:10px 4px 18px;box-sizing:border-box;font:16px system-ui;background:${mode === "ios" ? "#d1d3d9" : "#e3e7ed"}`;
    pad.addEventListener("mousedown", (e) => e.preventDefault());
    for (const row of [...ROWS, " "]) {
        const line = document.createElement("div");
        line.style.cssText = "display:flex;gap:5px;justify-content:center";
        for (const ch of row === " " ? ["space"] : row) {
            const key = document.createElement("span");
            key.textContent = ch;
            key.style.cssText = `background:#fff;border-radius:5px;height:42px;display:flex;align-items:center;justify-content:center;${ch === "space" ? "width:60%" : "flex:0 1 32px"}`;
            line.append(key);
        }
        pad.append(line);
    }
    // On the page's root, not body: the iPhone fake slides body, and the keyboard must stay put.
    root.append(pad);

    const apply = () => {
        const field = typable(document.activeElement)
            ? (document.activeElement as HTMLElement)
            : null;
        // A phone keyboard with its suggestions row: about 40% of the screen, at most 300 px.
        const height = field ? Math.min(Math.round(window.innerHeight * 0.4), 300) : 0;
        pad.style.display = height ? "flex" : "none";
        pad.style.height = `${height}px`;
        fakeView.covered = height;
        if (mode === "android") {
            fakeView.shrink = height;
            fakeView.pan = 0;
            root.style.setProperty("--fake-keyboard", `${height}px`);
        } else {
            fakeView.shrink = 0;
            root.style.removeProperty("--fake-keyboard");
            document.body.style.transform = "";
            // As iOS: a field lower than the middle of what stays visible is moved to that middle.
            const r = field?.getBoundingClientRect();
            const centre = r ? (r.top + r.bottom) / 2 : 0;
            fakeView.pan =
                r && r.width > 0
                    ? Math.max(0, Math.round(centre - (window.innerHeight - height) / 2))
                    : 0;
            document.body.style.transform = fakeView.pan ? `translateY(${-fakeView.pan}px)` : "";
        }
        onChange();
    };
    const later = () => setTimeout(apply, 0);
    document.addEventListener("focusin", later);
    document.addEventListener("focusout", later);
}
