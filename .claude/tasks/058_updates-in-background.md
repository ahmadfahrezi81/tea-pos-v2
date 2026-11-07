# Task 058 — Every update downloads behind the header

**Status: built 2026-11-07, checked locally, reviewed by the owner; PR into staging, then the owner checks on phones.**

## The goal

Today a fresh open with a new build shows a full page until the download is in; in use, the same download runs behind the header and then counts down to the reload. On iPhone the full page does not show: a home-screen app is usually woken, not opened afresh, so the app never counts as a fresh open. The owner's call: no full page on open at all. Every update downloads behind the header, the same on iPhone, Android and the web.

**And it feels slow, on every phone** (owner, 2026-11-06: "like a minute", a feeling, not timed), so it is not the device. The update is small: about 1 MB in 130 files per app (backoffice 979 KB, seller 890 KB), a few seconds on 4G. The cause is not known yet: the app may not notice the download is done (it gives up waiting at 60 s, `DOWNLOAD_LIMIT_MS`), the files may come one by one, or the countdown before the reload may add to it. Measured before anything changes.

## What was slow (measured 2026-11-07)

Workbox's install saves the new build's files **one at a time** (its own comment: "Cache entries one at a time", workbox-precaching 7.4.1, `PrecacheController.install`). An app lists 131 files; between two builds that differ only in their version, 62 change. Locally, behind a server that waits 150 ms per file (a phone's round trip):

| | First install (131 files) | Update (62 changed) |
| --- | --- | --- |
| Workbox's install | 20.8 s | about 10 s |
| Ours, 8 at a time | 6.9 s | 3.5 s |

Second look (2026-11-07): Pages answers `/index.html` with a 308 to `/`, and a redirected answer cannot open a screen (every browser refuses it), so the install saves a copy without the redirect, as Workbox does. Like Workbox, only revisioned files (`index.html`) skip the browser's cache; hashed files may come from it, so the first install does not download what the page just loaded. Checked behind a local server that redirects the same way: `index.html` saved whole and not redirected, a deep link opens from the worker.

The local server speaks HTTP/1.1, where a browser opens at most 6 connections; Cloudflare's HTTP/2 has no such cap, so a phone gains more than this.

## The plan

0. **Done: measured** (above). **Our own worker,** `packages/config/sw.ts` (`strategies: "injectManifest"` in `packages/config/vite.ts`; `workbox-precaching` and `workbox-routing` listed in `packages/config/package.json`, the versions the plugin already used): the install saves 8 files at a time and skips what is saved; Workbox still serves the files, removes old ones and falls back to `index.html` for screens; `SKIP_WAITING` from the app, as before. `AppUpdate.tsx` reads both shapes of the file list in `sw.js`. Was: **Measure first:** on staging, an update timed from the check to the reload, with what `tick()` sees each round (the waiting worker, files saved against the new list). Find what keeps it from finishing in seconds, fix that, and check it again: done in under 10 s on a normal connection
1. **Done.** **`packages/shell/frame/AppUpdate.tsx`:** drop the fresh-open full page (`fresh`, and `block(true)` in `check` and `onNeedRefresh`). Every new build goes through `download()` and the header
2. **Done** (`pageshow` with `persisted` checks too). **Waking on iPhone:** the check already runs on `visibilitychange` (and a tap, once a minute at most). Make sure it also runs when iOS shows the app again through `pageshow` (a page restored from memory), and that the first check is not lost when the worker registers after a tap (`whenIdle` falls back to a 1 s timer where `requestIdleCallback` is missing)
3. **Kept as is:** the full page after a `426` (this build is too old to be safe), the attempt limit, Update app on More
4. Remove what only the fresh-open page used (its words in `packages/i18n` if no longer read; the page itself stays for the 426)

## Intended on iPhone: no download bar on a fresh open (owner, 2026-11-07)

Opened afresh (killed, then opened) with a new build out, an iPhone shows nothing for 5-10 s, then **Update ready**, then restarts. That is expected, not a bug: iOS starts every home-screen app from scratch and fetches the new worker itself at launch; worker jobs run one at a time, so our `registerSW` (and with it our check and the download bar) waits until that download is done. Android checks later, so ours goes first and the bar shows. Settled: the countdown says **Update ready · 5s [Restart]**, so the restart is never a surprise; the logic stays as is. Moving our check before `registerSW` would show the bar on iPhone too; not done, so Android's working flow is untouched.

## Owner's part

- On staging, with the app installed on an iPhone and an Android phone: deploy twice, open each from the home screen, and check the header shows the download, then counts down and reloads

## Done when

- An update on a normal connection is in and reloading within 10 s, measured on staging
- No full page on any open unless the server answered 426
- On iPhone and Android, opening or coming back to the app after a deploy shows the header download within a minute
- `pnpm lint`, `pnpm typecheck`, `pnpm test` pass

## Not in this task

- Downloading only on Wi-Fi, or asking before downloading
