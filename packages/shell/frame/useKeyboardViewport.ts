import { useEffect, type RefObject } from "react";

/** Less than this between the page and what is visible is a toolbar, not a keyboard. */
const KEYBOARD_PX = 120;

/**
 * Keeps the app's frame in the visible area while the iPhone's keyboard is open, so the header
 * stays and the bottom (a chat's message box) sits on the keyboard, as Android does by itself
 * (`interactive-widget=resizes-content`, which iOS ignores: it pans the whole page instead).
 * Android and a closed keyboard: nothing set.
 */
export function useKeyboardViewport(frame: RefObject<HTMLElement | null>) {
    useEffect(() => {
        const vv = window.visualViewport;
        const el = frame.current;
        if (!vv || !el) return;
        let raf = 0;
        const apply = () => {
            raf = 0;
            const open = document.documentElement.clientHeight - vv.height > KEYBOARD_PX;
            if (!open) {
                el.style.removeProperty("height");
                el.style.removeProperty("transform");
                return;
            }
            el.style.height = `${vv.height}px`;
            // Wherever iOS panned to, the frame follows: its top is the visible top.
            el.style.transform = `translateY(${vv.pageTop}px)`;
        };
        const schedule = () => {
            if (!raf) raf = requestAnimationFrame(apply);
        };
        vv.addEventListener("resize", schedule);
        vv.addEventListener("scroll", schedule);
        return () => {
            cancelAnimationFrame(raf);
            vv.removeEventListener("resize", schedule);
            vv.removeEventListener("scroll", schedule);
            el.style.removeProperty("height");
            el.style.removeProperty("transform");
        };
    }, [frame]);
}
