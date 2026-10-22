// Matches `.boot`'s transition in ui/styles/boot.css.
const FADE_MS = 200;

/** Fades out index.html's splash, once. Safe to call again. */
export function hideSplash() {
    const splash = document.getElementById("splash");
    if (!splash || splash.dataset.leaving !== undefined) return;
    splash.dataset.leaving = "";
    // A timer, not transitionend: there is no transition under reduced motion.
    setTimeout(() => splash.remove(), FADE_MS);
}
