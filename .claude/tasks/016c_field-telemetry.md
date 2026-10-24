# Task 016c — Real speed from real phones, and errors worth reading

**Status: built 2026-10-24 on branch `feat/field-telemetry` (on top of 016b's `feat/monitoring-versions`), not committed. Checked locally, against a production build of seller on a local Go (staging database):**
- **Against the benchmark:** `pnpm bench` now checks it itself (below): all 6 loads (3 reopens, 3 first visits) reported the bench's own time and the right `open` (`saved`, `network`), `me` (`saved` on reopens, `network` on first visits), `screen: shell`, `hidden: false`
- **Against a recording:** 3 throttled reopens with screenshots: the first frame that changes comes 40-49 ms (2-3 frames) after the mark: the splash's fade beginning to paint under 20× CPU. Not one frame as planned, but a few milliseconds on a real phone against opens of 0.5-3.5 s, so the mark stays (the bench's too)
- **Each case by hand:** a reopen `saved`; the first open of a new build `update`; the next `saved`; a load opened behind another tab `hidden: true` (it only becomes ready once shown: the shell waits for a painted frame)
- **Errors:** chunk ids injected (PostHog's CLI 0.18.9, 7 files paired), 5 registered on the page; an error's batch carried its file's chunk id, the same as the `//# chunkId` in that file; the session id a valid UUIDv7; device and network fields present
- **Size:** the first screen 125.8 KB (016b: 126.1 KB): everything here loads after it (`events.ts` is imported when idle). At deploy the chunk ids add about 0.35 KB to the first screen's two files, which the PR's bundle check does not see
- **Not yet seen:** PostHog itself (web analytics, a readable stack, the alert, the dashboard), the real phone. After 016b and this are deployed to staging

**Found while building:**
- Maintenance took about 7 s to show on staging (016b): every failed query was retried 3 times. Answers that cannot change by asking again (`maintenance`, `app_too_old`, `not_signed_in`, `not_allowed`, `not_in_tenant`) are now not retried
- `pnpm bench` cannot see a request sent as a page closes, so it sends the app to the background after each load (as a seller switching apps does) and reads the batch then; it now prints `app_ready check: …` (and in the release PR's comment)
- Loading `events.ts` late at first split a 3.4 KB shared chunk out of the main file (an import both sides used); it takes the version tag as an argument instead
- PostHog's CLI inside a git checkout looks up a release through the API, so it needs the real key even to inject (CI has it)
- Chrome's throttling seems to leave the localhost page request itself alone (`htmlMs` 3 ms on first visits): to see on staging

## The goal

See how fast the apps really open on sellers' phones, per release and per kind of phone; give PostHog what its web analytics needs; make app errors readable and tell the owner when a new one appears. All without loading PostHog on the phone (016b's rule).
RFC: Monitoring and feature flags, the benchmark. Owner's decision 2026-10-24: "set it up once and set it up good".

## The plan

### 1. Sessions and devices

1. **`$session_id`** on every event: made on the phone, a UUIDv7 (PostHog's web analytics wants one ordered by time), kept in `localStorage` with the last activity; a new one after 30 minutes without any. About 300 bytes, in `packages/shell/events.ts`
2. **The device, from Go:** `/events` adds `$raw_user_agent` from the request; PostHog turns it into browser, OS and device type. The phone adds `$screen_width` and `$screen_height`
3. **`$pageleave`** as the app goes to the background, so web analytics can tell time in app and bounces
4. **Check on staging:** PostHog's Web analytics shows visits, sessions, Android versus iPhone. If `$raw_user_agent` is not turned into a device, Go sets `$os` and `$browser` itself from the header (a few lines; no library)

### 2. `app_ready`: how long each open really takes

**What is measured:** from the moment the phone starts loading the page (`performance.timeOrigin`) to the moment the app is usable: the existing `tea-pos:ready` mark, set where the splash lifts (the shell has drawn and `/me` is known). **The same mark `pnpm bench` reads**, so the lab numbers in the Benchmark log and the field numbers mean the same thing.

**One event per page load**, sent with the next batch:

| Property | What | Why |
| --- | --- | --- |
| `ready_ms` | the mark's time | the number |
| `open` | `network` (no service worker yet: a first visit or after clearing), `saved` (from the service worker's copy), `update` (the first open of a new version) | a reopen and a first visit are different numbers, as in the benchmark |
| `me` | `saved` (drawn from the phone's copy of `/me`) or `network` | whether the screen waited on the API |
| `screen` | `shell` or `signin` | the sign-in screen is lighter |
| `html_ms`, `js_ms` | when the page arrived (`responseStart`), when the main script finished (`domContentLoadedEventEnd`) | where the time went, without a trace |
| `net`, `rtt`, `downlink`, `save_data` | `navigator.connection` (Android Chrome) | 3G and 4G apart |
| `memory`, `cores` | `navigator.deviceMemory`, `hardwareConcurrency` | an M11 (3-4 GB, 8 cores) apart from a fast phone |
| app version, user, tenant | from Go, as for every event | per release, per store |

**What is left out, so the number stays honest:**
- **A load that was hidden at any moment before ready** (opened behind another app, the screen turned off): the timer runs while the phone does other things. A tiny inline script in `index.html` notes the first `visibilitychange` from the very start; such a load is sent with `hidden: true` and kept out of the dashboards
- **A return from the back-forward cache** (`pageshow` with `persisted`): no load happened, nothing is sent
- **Above 60 s:** sent with `outlier: true` (a stuck load is worth seeing, not averaging)

**Making sure it is right (the owner's ask), before it counts:**
1. **Against the benchmark:** `pnpm bench` on staging, then the `app_ready` events of those runs in PostHog: the same `ready_ms` as the bench's "app ready", each run (both read the same mark; this proves the event carries it unchanged, with the right `open`)
2. **Against a recording:** one throttled load recorded in DevTools (Performance, screenshots on): the frame where the splash lifts matches `ready_ms` within one frame
3. **Each `open` and `hidden` case by hand on staging:** a first visit (cleared site data), a reopen, the first open after a deploy, a load started in a background tab: each event says so
4. **On a real phone:** the owner opens staging on a phone, twice; the events show plausible numbers and the right device
5. **Only then** the dashboard below is trusted

**In PostHog:** a dashboard "App speed": median and 75th percentile of `ready_ms` per app and `open`, per week and per release, and split by `memory` (≤ 4 GB versus more). I build it through PostHog's API with the flags key's wider sibling, or write the clicks (owner's choice, see Owner's part)

### 3. Readable app errors (source maps)

App stacks today read `a.b (index-x7f.js:1:2345)`. PostHog turns them back into our files and lines with source maps.

1. **The build makes source maps** (`build.sourcemap: "hidden"`: the `.map` files exist, the JavaScript does not point to them, so a phone never downloads one; they stay out of the service worker's precache)
2. **Go sends each error's stack as frames** (file, function, line, column) in PostHog's `$exception_list` shape, parsed from the browser's stack text, instead of one string, so PostHog can match each frame
3. **The maps reach PostHog** one of two ways, whichever PostHog matches our frames with (checked on staging first):
   - **Uploaded at deploy:** `pages.yml` runs PostHog's CLI (`sourcemap inject` and `upload`) with a key allowed to write error tracking, then deletes the `.map` files before deploying
   - **Served beside the files:** the `.map` files deployed too; PostHog fetches them from the URL in each frame. The repo is public, so the source is no secret
4. **Done when:** an error thrown on purpose on staging shows in PostHog with our file name and line

### 4. Told about a new error

**Moved to Step 43 (owner's decision 2026-10-24).** PostHog's error alerts have no email: only Slack, Discord, webhooks and ticket tools. They go to the owner's Slack with deploy results later, in one step at the end of the build order. Until then errors are seen in PostHog, and outages come by email from Better Stack.

### 5. The flag rule, written down

In the RFC (Monitoring and feature flags) and `CLAUDE.md`: **a flag is checked in Go, not only in the screen**: a route behind `feature-qris` refuses while it is off; hiding a button is not protection. And: a flag that is fully on and unchanged for months (PostHog's **STALE**) becomes plain code when v2 rebuilds that feature, and the flag is deleted.

## Owner's part

- **Source maps:** uploaded (PostHog matches frames by the chunk id only). One more PostHog personal key, scopes error tracking write and organization read, both projects, as the GitHub secret `POSTHOG_SOURCEMAPS_KEY`; and the two project ids for `pages.yml`
- **The dashboard:** the owner's clicks (owner's choice 2026-10-24), written once staging has data
- **One real phone check** (section 2, point 4)

## Done when

- Web analytics on staging shows sessions, visits, and devices
- `app_ready` events match `pnpm bench` run for run, and a DevTools recording within a frame; each `open` and `hidden` case is right
- The "App speed" dashboard shows staging's numbers per app, open kind and release
- A thrown error on staging reads with our file and line in PostHog
- The first screen grows by no more than about 1 KB more (016b's 1 KB plus this); no `.map` file is downloaded by a phone
- The flag rule is in the RFC and `CLAUDE.md`

## Not in this task

- Business events from Go (order created, day closed): Steps 29 and 31
- Experiments (A/B tests): when there is something to test
- Watching `realtime` and `worker`: when they do real work
