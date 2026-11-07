// Matches `.boot`'s transition in ui/styles/boot.css.
const FADE_MS = 200;

/** Fades out index.html's splash, once. Safe to call again. */
export function hideSplash() {
    const splash = document.getElementById("splash");
    if (!splash || splash.dataset.leaving !== undefined) return;
    splash.dataset.leaving = "";
    // Up after all: the watchdog's report is already queued with this load's events.
    try {
        localStorage.removeItem("tea-pos:boot-stuck");
    } catch {
        // Reported again by the next load: harmless.
    }
    // The moment the app is usable, labelled on the Performance panel's Timings track.
    performance.mark("tea-pos:ready");
    // A timer, not transitionend: there is no transition under reduced motion.
    setTimeout(() => splash.remove(), FADE_MS);
}
