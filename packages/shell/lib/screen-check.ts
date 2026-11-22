/**
 * The screen check (`?screen` in the address, any build; task 073): a small panel with what the
 * phone reports about the screen, live, and the last events with those numbers, so a shifted
 * screen on a phone shows why. Changes nothing. Drawn without React, from the app's start, so
 * it works on sign-in too; kept on for the visit.
 */

export const SCREEN_CHECK_KEY = "tea-pos:screen-check";
const KEEP = 12;

function numbers(): Record<string, string | number> {
    const vv = window.visualViewport;
    const root = document.documentElement;
    const frame = document.getElementById("shell-scroll")?.closest("main")?.parentElement;
    const rect = frame?.getBoundingClientRect();
    const focused = document.activeElement;
    const r = (n: number | undefined) => (n === undefined ? "-" : Math.round(n * 10) / 10);
    return {
        inner: r(window.innerHeight),
        client: r(root.clientHeight),
        "vv h": r(vv?.height),
        "vv top": r(vv?.offsetTop),
        "vv page": r(vv?.pageTop),
        scale: r(vv?.scale),
        scrollY: r(window.scrollY),
        "body top": r(document.body.scrollTop),
        "frame h": r(rect?.height),
        "frame top": r(rect?.top),
        shell: root.style.getPropertyValue("--shell-height") || "-",
        keyboard: root.dataset.keyboard ?? "-",
        installed: matchMedia("(display-mode: standalone)").matches ? "yes" : "no",
        focus:
            focused && focused !== document.body
                ? `${focused.tagName.toLowerCase()}${focused.id ? `#${focused.id}` : ""}`
                : "-",
    };
}

const line = (n: Record<string, string | number>) =>
    Object.entries(n)
        .map(([k, v]) => `${k} ${v}`)
        .join(" · ");

export function startScreenCheck() {
    const log: string[] = [];
    const t0 = performance.now();

    const panel = document.createElement("div");
    panel.setAttribute("aria-hidden", "true");
    panel.style.cssText =
        "position:fixed;top:calc(env(safe-area-inset-top) + 64px);right:4px;z-index:2147483647;" +
        "max-width:min(92vw,360px);max-height:45vh;overflow:auto;padding:6px 8px;border-radius:8px;" +
        "background:rgb(0 0 0 / 0.78);color:#fff;font:11px/1.35 ui-monospace,monospace;" +
        "pointer-events:auto;-webkit-user-select:text;user-select:text";
    const now = document.createElement("div");
    const events = document.createElement("div");
    events.style.cssText = "margin-top:4px;opacity:0.85;white-space:pre-wrap";
    const bar = document.createElement("div");
    bar.style.cssText = "display:flex;gap:6px;margin-top:6px";
    const button = (label: string, act: () => void) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = label;
        b.style.cssText =
            "padding:2px 8px;border-radius:5px;background:#fff;color:#000;font:inherit";
        b.addEventListener("click", act);
        bar.append(b);
        return b;
    };
    const copy = button("Copy", () => {
        const text = `${line(numbers())}\n\n${log.join("\n")}`;
        void navigator.clipboard?.writeText(text).then(
            () => (copy.textContent = "Copied"),
            () => (copy.textContent = "Copy failed"),
        );
    });
    let small = false;
    const fold = button("Small", () => {
        small = !small;
        events.style.display = small ? "none" : "";
        fold.textContent = small ? "More" : "Small";
    });
    button("Off", () => {
        try {
            sessionStorage.removeItem(SCREEN_CHECK_KEY);
        } catch {
            // Gone with the visit anyway.
        }
        panel.remove();
        clearInterval(timer);
    });
    panel.append(now, events, bar);
    document.body.append(panel);

    const draw = () => {
        now.textContent = line(numbers());
        events.textContent = log.join("\n");
    };
    const note = (what: string) => {
        const n = numbers();
        const s = ((performance.now() - t0) / 1000).toFixed(2);
        log.unshift(
            `${s}s ${what}: vv ${n["vv h"]}@${n["vv top"]} client ${n.client} scrollY ${n.scrollY} frame ${n["frame h"]}@${n["frame top"]}`,
        );
        log.length = Math.min(log.length, KEEP);
        draw();
    };

    window.addEventListener("resize", () => note("resize"));
    window.visualViewport?.addEventListener("resize", () => note("vv resize"));
    window.visualViewport?.addEventListener("scroll", () => note("vv scroll"));
    window.addEventListener("scroll", () => note("page scroll"), { passive: true });
    document.addEventListener("focusin", () => note("focus in"));
    document.addEventListener("focusout", () => note("focus out"));
    document.addEventListener("visibilitychange", () => note(document.visibilityState));
    window.addEventListener("pageshow", () => note("page shown"));
    // The numbers between events: a shift that came with no event shows here.
    const timer = setInterval(draw, 500);
    note("start");
}
