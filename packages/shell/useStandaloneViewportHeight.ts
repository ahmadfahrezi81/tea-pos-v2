import { useEffect } from "react";

/** Some platforms report the old size on resume and the real one a moment later. */
const SETTLE_MS = 300;

/**
 * Keeps the installed app pinned to the real screen height. Installed, CSS
 * viewport units go stale after the phone sleeps, clipping the footer; in a tab
 * `svh` is right and this stays out of the way. Reads `clientHeight` (the layout
 * viewport), never `innerHeight`, which shrinks with the iOS keyboard.
 */
export function useStandaloneViewportHeight() {
    useEffect(() => {
        const standalone = window.matchMedia("(display-mode: standalone)");
        const root = document.documentElement;

        const apply = () => {
            if (!standalone.matches) {
                root.style.removeProperty("--shell-height");
                return;
            }
            root.style.setProperty("--shell-height", `${root.clientHeight}px`);
        };

        // Visible again does not mean done resizing: measure now, next frame, and once more.
        let frame = 0;
        let timer: ReturnType<typeof setTimeout>;
        const applyThenSettle = () => {
            apply();
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(apply);
            clearTimeout(timer);
            timer = setTimeout(apply, SETTLE_MS);
        };

        const onVisibilityChange = () => {
            if (document.visibilityState === "visible") applyThenSettle();
        };

        apply();

        // The resume signals overlap on purpose: which one fires depends on how the app was paused.
        window.addEventListener("resize", apply);
        window.visualViewport?.addEventListener("resize", apply);
        window.addEventListener("orientationchange", applyThenSettle);
        window.addEventListener("pageshow", applyThenSettle);
        window.addEventListener("focus", applyThenSettle);
        document.addEventListener("visibilitychange", onVisibilityChange);
        // iOS can settle display-mode late.
        standalone.addEventListener("change", apply);

        return () => {
            cancelAnimationFrame(frame);
            clearTimeout(timer);
            window.removeEventListener("resize", apply);
            window.visualViewport?.removeEventListener("resize", apply);
            window.removeEventListener("orientationchange", applyThenSettle);
            window.removeEventListener("pageshow", applyThenSettle);
            window.removeEventListener("focus", applyThenSettle);
            document.removeEventListener("visibilitychange", onVisibilityChange);
            standalone.removeEventListener("change", apply);
            root.style.removeProperty("--shell-height");
        };
    }, []);
}
