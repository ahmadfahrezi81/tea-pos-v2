# Task 017 — The worker: River, the weather jobs, jobs saved with the change

**Status: planned 2026-10-24, waiting on the owner's review.**

## The goal

Background jobs and schedules move into Go, so the old app's outside cron website can retire, and every later job that touches money (close-day commissions, auto-claims, QRIS payments) is saved in the same transaction as the change that causes it: both happen or neither does.
RFC: Backend (Background jobs and schedules), Scheduled jobs. Build order Step 17, the first of the Foundations.

## Where it stands today

- `cmd/worker` connects to the database and waits; it does nothing
- The old app's cron website calls `/api/cron/weather/fetch` (the hourly forecast from Tomorrow.io, every hour at :45) and `/api/cron/weather/realtime` (the current weather, every 20 minutes 05:00-22:00 WIB) on production. Both upsert `weather_hourly` (on `date, hour`), for Bogor (Ciomas). Staging has no cron
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
6. **Schedules off unless switched on:** `JOBS_SCHEDULE=on` in production only (`railway.ts`). Staging's and a laptop's worker run jobs that are inserted, never the schedules, so staging never fetches twice and a laptop never writes to a shared database on its own
7. **Staging's weather, once a day at 21:00 WIB:** a scheduled GitHub Actions workflow (`staging-weather.yml`) runs `go run ./cmd/worker -once weather_forecast` against the staging database. It also keeps the staging Supabase project awake (it pauses after a week without use)
8. **`TOMORROW_IO_API_KEY`** for the worker, from Infisical (`preserve()` in `railway.ts`); GitHub gets the same for the staging workflow
9. **The proof that "both or neither" holds:** an integration test that writes a row and inserts a job in one transaction and rolls it back (neither exists), then commits (both exist); one that runs the weather job against a fake Tomorrow.io and checks the rows; and one for the cells: two stores 300 m apart make one cell, a store 20 km away a second, a closed store's cell is not fetched at night
10. **Switching over:** once production's `weather_hourly` shows rows written by v2's worker (its `fetched_at` matching v2's schedule), the owner switches off the two weather calls on the cron website. Both writing the same rows in between is harmless (an upsert on `date, hour`)

## Owner's part

- **Tomorrow.io:** the existing key (the old app's `TOMORROW_IO_API_KEY`) into Infisical `prod` `/app` and `/github` (for the staging workflow). One key is enough: the free plan allows far more calls than three schedules use
- **After v2's first production rows:** switch off the two weather jobs on the cron website (I'll say when, with what to check)

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
