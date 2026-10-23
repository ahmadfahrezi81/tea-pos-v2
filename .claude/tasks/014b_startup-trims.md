# Task 014b — Startup trims for slow phones

**Status: done 2026-10-22, PR #17. The owner's trace on the preview (incognito, 20× CPU, Slow 4G, reopen): splash at about 0.35 s, app ready at about 1.5 s, 760 ms of scripting. Only the picked language loads. Item 3 dropped (below).**

## The goal

Less work before the first screen on a phone like the Galaxy M11: the browser parses only the code that open needs. Pages only, so it merges at once.
RFC: Build order Step 14b; Performance budgets (What shortens the boot, Ways to go below 124 KB).

## The plan

1. **Preload only the active language.** Today index.html preloads both `en` and `id`, so seller parses one it never uses. Instead a tiny inline script in index.html picks the language and preloads just that file. It is `pickLocale` itself (from `packages/i18n`, written so it needs nothing else), inlined by `packages/config/vite.ts` with the app's languages, so there is one rule for choosing, not two. `startApp` uses the language it picked
2. **The service worker after the first paint.** Registering it loads `workbox-window` and the worker starts installing at once, competing with the app's own startup. It moves to after the splash has gone (`requestIdleCallback`, with a timeout for Safari). Updates are still checked on every return to the app
3. ~~**The saved-cache code on demand.**~~ The IndexedDB persister and `idb-keyval` move into their own chunk, loaded in parallel with the first screen rather than parsed as part of the main file. The saved data still arrives before the first request needs it
4. **Dropped while building, item 3:** the saved-cache code is about 3 KB of the 111.6 KB main file. Loading it separately costs more than it saves: either an extra network request on every cold open before the saved data lands, or the screen waiting for one more file. It stays in the main file
5. **Measure before and after:** `pnpm bundle-size` and a performance trace at 20× CPU on Slow 4G, both written into the PR

## Done when

- Seller's first screen preloads one language file, and the bundle check shows the main file smaller
- The service worker still installs, and the update sheet still appears after a deploy (checked on staging)
- A cold open with saved data still shows it without waiting for the network
- The numbers before and after are in the PR

## Not in this task

Preact (its own trial on a branch, if wanted). The Go half of Step 16b.

## Follow-up, 2026-10-23: the benchmark in one snippet

Reading numbers off the trace was slow and LCP often caught the splash. `docs/benchmark.js` is one DevTools Snippet (`!bench`) that prints splash, LCP, app ready (`tea-pos:ready`, set by `hideSplash`), `/me` start and answer, main script arrival, long tasks and reopen or first visit. The RFC's benchmark section links it, with the 2026-10-23 baseline: ready 1.63 s on a reopen.
