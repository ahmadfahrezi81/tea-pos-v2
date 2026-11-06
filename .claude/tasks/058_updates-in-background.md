# Task 058 — Every update downloads behind the header

**Status: approved 2026-11-06 (item 1 of the [feedback RFC](https://app.notion.com/p/41095a715405814b80c1ddb3b5bf8e44)), in progress.**

## The goal

Today a fresh open with a new build shows a full page until the download is in; in use, the same download runs behind the header and then counts down to the reload. On iPhone the full page does not show: a home-screen app is usually woken, not opened afresh, so the app never counts as a fresh open. The owner's call: no full page on open at all. Every update downloads behind the header, the same on iPhone, Android and the web.

**And it feels slow, on every phone** (owner, 2026-11-06: "like a minute", a feeling, not timed), so it is not the device. The update is small: about 1 MB in 130 files per app (backoffice 979 KB, seller 890 KB), a few seconds on 4G. The cause is not known yet: the app may not notice the download is done (it gives up waiting at 60 s, `DOWNLOAD_LIMIT_MS`), the files may come one by one, or the countdown before the reload may add to it. Measured before anything changes.

## The plan

0. **Measure first:** on staging, an update timed from the check to the reload, with what `tick()` sees each round (the waiting worker, files saved against the new list). Find what keeps it from finishing in seconds, fix that, and check it again: done in under 10 s on a normal connection
1. **`packages/shell/frame/AppUpdate.tsx`:** drop the fresh-open full page (`fresh`, and `block(true)` in `check` and `onNeedRefresh`). Every new build goes through `download()` and the header
2. **Waking on iPhone:** the check already runs on `visibilitychange` (and a tap, once a minute at most). Make sure it also runs when iOS shows the app again through `pageshow` (a page restored from memory), and that the first check is not lost when the worker registers after a tap (`whenIdle` falls back to a 1 s timer where `requestIdleCallback` is missing)
3. **Kept as is:** the full page after a `426` (this build is too old to be safe), the attempt limit, Update app on More
4. Remove what only the fresh-open page used (its words in `packages/i18n` if no longer read; the page itself stays for the 426)

## Owner's part

- On staging, with the app installed on an iPhone and an Android phone: deploy twice, open each from the home screen, and check the header shows the download, then counts down and reloads

## Done when

- An update on a normal connection is in and reloading within 10 s, measured on staging
- No full page on any open unless the server answered 426
- On iPhone and Android, opening or coming back to the app after a deploy shows the header download within a minute
- `pnpm lint`, `pnpm typecheck`, `pnpm test` pass

## Not in this task

- Downloading only on Wi-Fi, or asking before downloading
