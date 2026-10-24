# Task 016b — Monitoring and versions

**Status: built 2026-10-24, not committed: waiting on the owner's code review and clicks. Verified locally: integration tests (426, Server-Timing, maintenance, /me flags, /events), and in the browser against a local Go on the staging database: `X-App-Version` on every request, `Server-Timing` in DevTools, a thrown error and page views reaching `/events` with the user and version. Bundle 125.0 → 126.0 KB per app. Not yet seen: PostHog receiving them (needs the keys), the maintenance screen and 426 in the browser (need a flag and a release build), the Railway variable on a real deploy.**

## The goal

Errors from both apps and Go show in PostHog, an outage reaches the owner's phone, and every request says which app version sent it, before the backoffice pilot.
RFC: Monitoring and feature flags, Versioning, Go (Server-Timing). Build order Step 16b.

## Where it stands today

- `/health` says `"version":"dev"` in both environments: the Dockerfile has `ARG APP_VERSION=dev` and nothing passes it
- The apps know their commit (`__APP_COMMIT__`) but no release version, and send nothing about either to Go
- No PostHog, no `Server-Timing`, no uptime check

## One PR

The owner's clicks (PostHog, the uptime checker) can come before or after the merge: without `POSTHOG_KEY` Go sends nothing and every flag is off.

## The plan, part 1: versions

1. **The release version, from the release PR's title** (`release: 2026.10.6`). `deploy.yml`'s `plan` job reads it on `main`. On `staging` the version is `staging`. Every build gets `APP_VERSION`:
   - **Go:** before deploying, `scripts/railway-deploy.mjs` sets the service variable `APP_VERSION` (Railway's `variableUpsert`, `skipDeploys`). The Dockerfile already turns it into `version.Version`. In `railway.ts` it is declared `preserve()`, so an apply keeps it. The script now needs `APP_VERSION` (runbook updated)
   - **Apps:** `pages.yml` takes a `version` input, and the build defines `__APP_VERSION__` beside `__APP_COMMIT__`. Previews say `preview`
2. **The status screen** shows `2026.10.6 (a1b2c3d)`, from `packages/shell/version.ts` (there is no Account screen yet; it takes the same value)
3. **`X-App-Version: seller@2026.10.6+a1b2c3d`** on every request from `packages/api-client`, and on index.html's early `/me` (the app name comes from `app.config.ts`). Go's request log gets `app_version`, `db_ms`, `user_id` and `tenant_id`
4. **426:** the config value `MIN_APP_VERSION` (e.g. `seller@2026.10.4,backoffice@2026.10.2`; absent means no cut-off), declared in `railway.ts` by the release PR that needs it. The app name is the forwarder's `X-App`, which a phone cannot set. A request from an older app gets 426 with the code `app_too_old`. A request without the header (curl, `/health`), or from staging and previews, is never refused. The apps answer 426 by applying the waiting update and reloading; if no update is waiting, they reload once
5. **`Server-Timing: db;dur=12.3, app;dur=15.1`** on every API response: `db` is the time at least one query was running (queries side by side count once), `app` the whole request. A pgx tracer (`platform.DBTimer`) and `middleware/track.go`. DevTools' Timing tab shows it
6. **Tests:** integration tests for 426 (old, current, missing, malformed header) and for the `Server-Timing` header; e2e checks that `/health` on staging says `staging`, and that `Server-Timing` and `/events` work through the forwarder

## The plan, part 2: PostHog (only in Go) and uptime

**The browser never loads `posthog-js`** (owner's decision 2026-10-24): it is 50-60 KB, ad blockers block its address, and Go can do the same job. The phone sends small events to our own `/api`; Go adds who and which version and forwards them to PostHog.

1. **`POST /api/events`** (`auth.SignedIn`): a batch of up to 50 errors and page views. Go adds the user, role, app and `X-App-Version`, and sends them on with `posthog-go` in the background. Errors use PostHog's `$exception` shape, so error tracking groups them. Not rate limited (the sign-in limiter would be shared); a batch cap and the phone's own caps instead. Errors before sign-in are not sent (the route needs a session)
2. **In the apps** (`packages/shell/events.ts`, about 1 KB): a tiny inline script in `index.html` queues errors from the very start (at most 20 a page load); errors a screen's error boundary catches, and each route change (`$pageview`), join the queue (at most 100). Sent every 10 s, and as the app goes to the background (`fetch` with `keepalive`, so it carries `X-App-Version`); a failed send is dropped
3. **Errors in Go:** every error logged (a panic, a 5xx's cause, a failed lookup) is also sent as an `$exception` with the request id, user, tenant and app version, through `posthog-go`'s slog handler (`platform.SetupLog`), in the background. The request line of a 5xx is not sent twice. Only `api` for now; `realtime` and `worker` when they do real work
4. **Flags, evaluated in Go:** `posthog-go`'s local evaluation (the rules held in memory). **PostHog bills each rules download as 10 flag checks, with 1M free a month:** production downloads every 60 s (432k a month), staging every 5 min (86k); every 30 s in both would be 1.7M. Rules can use `role`, `app` (v2 only: v1 sends none), `tenantId` and `storeId`, v1's names, so its rules keep working. `/me` returns `flags` for the user (role, app) and `flags` on each store (plus tenantId and storeId: what v1 asked `/api/flags?storeId=` for), all in memory. One flag per purpose, not per app: a rule `app = seller` limits it to one app. `internal/telemetry`
5. **Maintenance:** the flag `ops-maintenance` is checked by Go on every signed-in request (in memory, free; after the tenant, so a rule can name one) and answers 503 `maintenance`; the shell covers the screen (`BootScreen`, already translated) and asks again every 15 s; when it is over, every screen's data reloads. Admins are let through, so the owner can check before reopening; sign-in and `/health` stay open. On and off take up to a minute (the download interval) plus the next request. Pushed to open phones once the realtime hub exists (Step 26)
6. **Without `POSTHOG_KEY`** (local, tests) nothing is sent and every flag is off
7. **Uptime:** Better Stack (free: every 3 minutes, four regions; owner's choice 2026-10-24 over UptimeRobot, whose free plan checks every 5 minutes and has no free push) calls production's `https://tea-pos.lykostech.app/api/health` (Cloudflare, the forwarder and Go in one check) and alerts the owner by email; push, SMS and calls are paid. Staging is not watched
8. **Runbook:** where errors are, how to turn maintenance on and off, what an uptime alert means and the first three things to check

## Owner's part

- **PostHog:** done 2026-10-24: the old app's TEA-POS-PROD and TEA-POS-STG reused (US region), a new personal key `tea-pos-v2 go flags` (feature flags read, both projects); both keys checked to load the flag rules. Planned: two projects, `tea-pos-staging` and `tea-pos-production` (or reuse the old app's project for production; your call), with error tracking on. Into Infisical (`staging` and `prod`, path `/app`): `POSTHOG_KEY` (the project key) and `POSTHOG_FLAGS_KEY` (a personal key with feature-flag read only, for local evaluation, as the old app has). If the account is in the EU region, also `POSTHOG_HOST=https://eu.i.posthog.com` (and I declare it in `railway.ts`)
- **The flag `ops-maintenance`** in each project, off
- **Uptime:** done 2026-10-24, Better Stack, email alerts

## Why the update sheet takes a while (owner's question, no change)

The app checks for a new version 5 s after it starts and each time it comes back to the foreground, at most once a minute; then it downloads the whole new version before showing the sheet, so Update reloads instantly and works offline. A phone kept open on one screen checks only when it is next reopened. Kept as is; the one addition is that a 426 starts a check at once.

## Done when

- Production `/health` says `2026.10.N` after the next release that changes the API, staging's says `staging`, and the status screen says the same (a release that leaves the API or the apps alone keeps the version they were last deployed with)
- Go's log shows `app_version` for requests from the apps
- With `MIN_APP_VERSION` set above the running app, the app reloads into the new version; requests without the header are untouched
- DevTools shows `Server-Timing` with `db` and `app` on API calls
- A thrown error in each app, and a forced 5xx in Go, show in PostHog with the version, user and tenant; page views show per app
- The apps load no PostHog code; the first screen's bundle grows by no more than about 1 KB
- Turning `ops-maintenance` on shows the maintenance screen within about a minute and a half, and off the same
- A test alert from Better Stack reaches the owner's email

## Found while building

- PostHog bills flag-rule downloads (above): the reason for 60 s and 5 min instead of 30 s
- Summing query times overstated `db` on `/me` (three queries side by side: 127 ms in a 50 ms request); it now counts overlapping time once
- `posthog-go` is released almost daily; pinned to v1.34.0, the newest at least two weeks old. Dependabot moves it weekly
- `api-client` had no React types; added `@types/react` (needed by its new `status.ts`)

## Not in this task

- Sessions and devices for web analytics, real open times from sellers' phones (`app_ready`), readable app errors (source maps), new-error alerts, the flag rule in the RFC: task 016c
- Feature flags beyond maintenance (the first is QRIS, Step 30)
- Business events from Go (order created, day closed): with those features, Steps 29 and 31
- The in-app What's new (patch notes)
- The API contract version in `info.version` (when the contract first changes in a way an older app notices)
- `pprof` and k6 (before the first big load change)
