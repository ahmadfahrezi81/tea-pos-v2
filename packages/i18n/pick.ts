import type { Locale } from "./index";

/**
 * The saved choice, else the phone's language, else the app's first; only languages
 * the app offers. Self-contained: index.html runs a copy of it before any JavaScript
 * loads (packages/config/vite.ts), to preload just that language. `/me` takes over in Step 13.
 */
export function pickLocale(offered: readonly [Locale, ...Locale[]]): Locale {
    let saved: string | null = null;
    try {
        saved = localStorage.getItem("tea-pos:locale");
    } catch {
        /* private mode: nothing saved */
    }
    const phone = navigator.language.slice(0, 2).toLowerCase();
    return offered.find((l) => l === saved) ?? offered.find((l) => l === phone) ?? offered[0];
}
