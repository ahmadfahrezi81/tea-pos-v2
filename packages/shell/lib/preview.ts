import { noteAnswer, noteTrouble } from "@tea-pos/api-client/connection";
import { recordFailure, failureFor } from "@tea-pos/api-client/failures";
import { toast } from "@tea-pos/ui/toast";

import { openErrorSheet } from "../frame/ErrorSheet";
import { setFakeKeyboard } from "../frame/keyboard";

/**
 * Local only (`import.meta.env.DEV`): `?preview=<name>` in the address shows a toast, a sheet or a
 * connection state, to look at their design. Never in a build.
 */
export function showPreview(name: string) {
    const failure = () => {
        recordFailure({
            at: new Date().toISOString(),
            method: "POST",
            path: "/tenants/test-a/orders",
            status: 500,
            code: "internal",
            message: "pq: deadlock detected",
            requestId: "4f6c1a2e-9b3d-4e1f-8a7c-2d5e6f708192",
        });
        return failureFor({ code: "internal", status: 500 });
    };
    const previews: Record<string, () => void> = {
        success: () => toast("Order confirmed 3 items · Rp 21.000", { kind: "success" }),
        error: () => toast("This store has closed for today.", { kind: "error" }),
        warning: () => toast("Not saved: no connection. Try again.", { kind: "warning" }),
        info: () => toast("Copied", { kind: "info" }),
        detail: () =>
            toast("Couldn't load the orders", {
                kind: "error",
                detail: "Pull down to try again.",
            }),
        sheet: () =>
            openErrorSheet({
                title: "Couldn't save",
                text: "Something went wrong. Try again.",
                failure: failure(),
            }),
        offline: () => window.dispatchEvent(new Event("offline")),
        failing: () => noteTrouble(),
        slow: () => [1500, 1500, 1500, 1500, 1500].forEach((ms) => noteAnswer(ms)),
        online: () => {
            window.dispatchEvent(new Event("online"));
            [80, 80, 80, 80, 80].forEach((ms) => noteAnswer(ms));
        },
        keyboard: fakeKeyboard,
        // Offline, then back 2 s later: a fresh page was never offline, so `online` alone shows nothing.
        back: () => {
            previews.offline!();
            setTimeout(previews.online!, 2000);
        },
    };
    // Only the previews' own names: a name from the address never reaches Object's methods.
    if (Object.hasOwn(previews, name)) previews[name]!();
}

const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

/**
 * A phone keyboard on the desktop: focusing a field shrinks the app by a keyboard's height, as
 * Android does (`resizes-content`), and draws one where the real one would be. Typing still uses
 * the desktop's keys; tapping the fake one keeps the field focused.
 */
function fakeKeyboard() {
    const pad = document.createElement("div");
    pad.setAttribute("aria-hidden", "true");
    pad.style.cssText =
        "position:fixed;left:0;right:0;bottom:0;z-index:9999;display:none;flex-direction:column;gap:8px;" +
        "padding:10px 4px 18px;background:#d1d5db;box-sizing:border-box;font:16px system-ui";
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
    document.body.append(pad);
    const typable = (el: Element | null) =>
        el instanceof HTMLTextAreaElement ||
        (el instanceof HTMLInputElement &&
            !["checkbox", "radio", "button", "submit", "file", "range", "hidden"].includes(
                el.type,
            ));
    const sync = () =>
        setTimeout(() => {
            // About a phone keyboard with its suggestions row: 40% of the screen, at most 300 px.
            const height = typable(document.activeElement)
                ? Math.min(Math.round(window.innerHeight * 0.4), 300)
                : 0;
            pad.style.display = height ? "flex" : "none";
            pad.style.height = `${height}px`;
            setFakeKeyboard(height);
        }, 0);
    document.addEventListener("focusin", sync);
    document.addEventListener("focusout", sync);
}
