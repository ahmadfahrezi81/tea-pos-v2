# Task 017 — The worker: River, the weather jobs, jobs saved with the change

**Status: built 2026-10-24, not committed (owner reviews first). Checked locally: unit tests for the cells and opening hours; integration tests: a job saved with its change or not at all, the weather per area against a fake Tomorrow.io (two areas at noon, one at 20:30, none at night, the old app's table only for its area, an observed hour never replaced by a forecast), the schedule on :00, :20, :40; the worker started against a fresh database with schedules on and stopped cleanly. Not yet seen: Tomorrow.io itself (needs the key), production rows, the cron website switched off. The old app's fixed point is always fetched (05:00-22:00, as the cron website), whatever the stores have: on staging no active store has a place yet, so without it v1's weather_hourly would stop.**

## The goal

Background jobs and schedules move into Go, so the old app's outside cron website can retire, and every later job that touches money (close-day commissions, auto-claims, QRIS payments) is saved in the same transaction as the change that causes it: both happen or neither does.
RFC: Backend (Background jobs and schedules), Scheduled jobs. Build order Step 17, the first of the Foundations.

## Where it stands today

- `cmd/worker` connects to the database and waits; it does nothing
- The old app's cron website calls `/api/cron/weather/fetch` (the hourly forecast from Tomorrow.io, every hour at :45) and `/api/cron/weather/realtime` (the current weather, every 20 minutes 05:00-22:00 WIB) on production. Both upsert `weather_hourly` (on `date, hour`), for Bogor (Ciomas). On staging it calls the forecast once a day at 21:00 (tea-pos-staging.vercel.app)
- Nothing in v2 reads `weather_hourly` yet (the old app's analytics does)

## The plan

1. **River** (`github.com/riverqueue/river` with its pgx driver; the newest release at least two weeks old): the job queue in Postgres, chosen in the RFC over a Redis queue because a job can be saved inside the change's own transaction
2. **Its tables in their own schema, `river`**, created by a normal migration in `supabase/migrations/` (River's own SQL, taken from its migration tool once and saved as the migration; never `rivermigrate` at start-up, since migrations only run through CI). `api/db/schema.sql` gains them after the next `db:schema`
3. **`internal/jobs`:** the job kinds and their arguments, a River client for inserting (used by `api`), and `Insert(ctx, tx, job)` that takes the caller's transaction, so a handler writes its change and its job in one `BEGIN … COMMIT`. A handler can never insert a job outside a transaction by mistake: the only insert takes one
4. **`cmd/worker`** runs the workers and the schedules: River periodic jobs, in WIB, each run once even if a second worker copy ever starts (River's leader election). **This is v2's cron:** a new scheduled task is one job type and its schedule in code; no outside cron website, no URL to call, no secret header. A job can queue the next one (the weather job seeing heavy rain queues a "rain alert" job, which later writes a chat message and announces it through 017b), so "when X, do Y" stays small Go code
5. **Weather per area, found from the stores** (owner, 2026-10-24: not one fixed point):
   - Each active store's coordinates fall into a **weather cell** of about 5 × 5 km (latitude and longitude rounded to 0.05°); stores in one cell share one fetch, so today's two stores are one fetch, as now. A store in another area makes a second cell by itself, with no setting
   - **One call per cell for both the current weather and the next 24 hours:** Tomorrow.io's Timelines API with only the three fields used (temperature, precipitation probability, weather code), timesteps `current` and `1h`, ending 24 hours ahead. Today's two calls return the whole multi-day forecast with every field; this returns a few KB
   - **When:** every 20 minutes while any store in the cell is open (its `open_time` to `close_time`), and one forecast an hour before the first opens; nothing at night. One cell is about 45 calls a day (v1: about 75). Tomorrow.io's free plan allows 25 calls an hour: up to about 8 cells at every 20 minutes; more cells stretch the interval (written in the job, logged when it does)
   - **Stored per cell:** a new table (`weather_cells`, `weather_hours` keyed by cell, date and hour), so each store reads its own cell's weather
   - **v1 keeps working:** its analytics reads `weather_hourly` (one location, unique on `date, hour`), so until v1 retires the worker also writes that table for the cell holding today's stores. Dropping it joins Step 40's cleanups
   - Retries with River's backoff; a job that fails for good is logged as an error (so PostHog sees it: `SetupLog` gets the telemetry client in the worker too)
6. **Schedules run on Railway, never on a laptop:** `JOBS_SCHEDULE=on` for both environments in `railway.ts`; a laptop's worker runs only what is queued, so it never writes to a shared database on its own
7. **Every schedule in one table in code, per environment** (owner, 2026-10-24: one mechanism, flexible and easy to keep): `jobs.Schedules`, one line per job with its ID, when it runs in production and when on staging (nil is never), and its arguments. A new schedule, or a change of timing, is a line in a PR, reviewed like any code; no setting per job. Today: the clean-up hourly on both; the weather off on both until Step 45, then production every 20 minutes (the job fetches only cells with a store open) and staging once a day at 21:00 WIB (every cell), which also keeps staging's Supabase awake (it pauses after a week without use). River's periodic jobs cost nothing between runs; new jobs arrive by LISTEN, and its fallback poll is every 5 seconds
8. **`TOMORROW_IO_API_KEY`** for the worker, from Infisical (`preserve()` in `railway.ts`), in `prod` `/app` and, by Step 45, `staging` `/app`
9. **The proof that "both or neither" holds:** an integration test that writes a row and inserts a job in one transaction and rolls it back (neither exists), then commits (both exist); one that runs the weather job against a fake Tomorrow.io and checks the rows; and one for the cells: two stores 300 m apart make one cell, a store 20 km away a second, a closed store's cell is not fetched at night
10. **Switching over: its own step, Step 45** (owner, 2026-10-24: never both fetching): the weather's line in `jobs.Schedules` is **off on both**, so a release ships the worker without it fetching. When the owner is ready: one PR fills in its two schedules, the release deploys it, and the owner deletes every job on the cron website (console.cron-job.org) within the same hour (production's hourly forecast and 20-minute current weather, and staging's once a day at 21:00). The clean-up schedule runs regardless

## Owner's part

- **Tomorrow.io:** the existing key (the old app's `TOMORROW_IO_API_KEY`) into Infisical `prod` `/app` (done 2026-10-24) and, before Step 45, `staging` `/app`. The copy in `prod` `/github` is no longer used (it was for a staging workflow, dropped): delete it. One key is enough: the free plan allows far more calls than both schedules use
- **Step 45:** delete every job on the cron website within the hour after its release

## Webhooks (owner's question)

A webhook is an outside service calling us (the payment provider saying "paid"); those live in `api` and come with their feature (QRIS, Step 30). Inside v2 none are needed: v1 needed the cron website to call URLs only because a Next.js app on Vercel has no program that keeps running. In v2 the API saves a change and queues its job in the same database, the worker runs it, the hub announces it. Calling another service later is one more job.

## Done when

- Production's weather is written by v2's worker per cell (and `weather_hourly` for v1), and the cron website's weather jobs are off (the owner confirmed they are its only jobs)
- Staging gets one forecast a day from the workflow, and its database stays awake
- The rollback test passes: a job saved with a change that is rolled back does not exist
- A failing job shows in PostHog as an error with its kind

## Not in this task

- The jobs that touch money (close day, auto-claims, QRIS): with their features, Steps 30 and 31, using `jobs.Insert`
- Showing the weather in v2: with the screen that needs it
