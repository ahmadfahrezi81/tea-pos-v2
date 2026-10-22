# Task 014b — Startup trims for slow phones

**Status: planned 2026-10-22, waiting on the owner's review.**

## The goal

Less work before the first screen on a phone like the Galaxy M11: the browser parses only the code that open needs. Pages only, so it merges at once.
RFC: Build order Step 14b; Performance budgets (What shortens the boot, Ways to go below 124 KB).

## The plan

1. **Preload only the active language.** Today index.html preloads both `en` and `id`, so seller parses one it never uses. Instead a tiny inline script in index.html picks the language and preloads just that file. It is `pickLocale` itself (from `packages/i18n`, written so it needs nothing else), inlined by `packages/config/vite.ts` with the app's languages, so there is one rule for choosing, not two. `startApp` uses the language it picked
2. **The service worker after the first paint.** Registering it loads `workbox-window` and the worker starts installing at once, competing with the app's own startup. It moves to after the splash has gone (`requestIdleCallback`, with a timeout for Safari). Updates are still checked on every return to the app
3. **The saved-cache code on demand.** The IndexedDB persister and `idb-keyval` move into their own chunk, loaded in parallel with the first screen rather than parsed as part of the main file. The saved data still arrives before the first request needs it
4. **Measure before and after:** `pnpm bundle-size` and a performance trace at 20× CPU on Slow 4G, both written into the PR

## Done when

- Seller's first screen preloads one language file, and the bundle check shows the main file smaller
- The service worker still installs, and the update sheet still appears after a deploy (checked on staging)
- A cold open with saved data still shows it without waiting for the network
- The numbers before and after are in the PR

## Not in this task

Preact (its own trial on a branch, if wanted). The Go half of Step 16b.
