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
4. **`cmd/worker`** runs the workers and the schedules: River periodic jobs, in WIB, each run once even if a second worker copy ever starts (River's leader election)
   - `weather_forecast`: every hour at :45, Tomorrow.io's hourly forecast for the next 24 hours, upserted
   - `weather_now`: every 20 minutes from 05:00 to 22:00, the current hour, upserted
   - The location (Ciomas, Bogor) and the WIB offset as today; the queries in `db/queries/weather.sql` (sqlc)
   - Retries with River's backoff; a job that fails for good is logged as an error (so PostHog sees it: `SetupLog` gets the telemetry client in the worker too)
5. **Schedules off unless switched on:** `JOBS_SCHEDULE=on` in production only (`railway.ts`). Staging's and a laptop's worker run jobs that are inserted, never the schedules, so staging never fetches twice and a laptop never writes to a shared database on its own
6. **Staging's weather, once a day at 21:00 WIB:** a scheduled GitHub Actions workflow (`staging-weather.yml`) runs `go run ./cmd/worker -once weather_forecast` against the staging database. It also keeps the staging Supabase project awake (it pauses after a week without use)
7. **`TOMORROW_IO_API_KEY`** for the worker, from Infisical (`preserve()` in `railway.ts`); GitHub gets the same for the staging workflow
8. **The proof that "both or neither" holds:** an integration test that writes a row and inserts a job in one transaction and rolls it back (neither exists), then commits (both exist); and one that runs the weather job against a fake Tomorrow.io and checks the rows
9. **Switching over:** once production's `weather_hourly` shows rows written by v2's worker (its `fetched_at` matching v2's schedule), the owner switches off the two weather calls on the cron website. Both writing the same rows in between is harmless (an upsert on `date, hour`)

## Owner's part

- **Tomorrow.io:** the existing key (the old app's `TOMORROW_IO_API_KEY`) into Infisical `prod` `/app` and `/github` (for the staging workflow). One key is enough: the free plan allows far more calls than three schedules use
- **After v2's first production rows:** switch off the two weather jobs on the cron website (I'll say when, with what to check)

## Open questions

1. **The cron website's other jobs, if any:** I only know the two weather ones. If it calls anything else, tell me and it joins this step

## Done when

- Production's `weather_hourly` is written by v2's worker on both schedules, and the cron website's weather jobs are off
- Staging gets one forecast a day from the workflow, and its database stays awake
- The rollback test passes: a job saved with a change that is rolled back does not exist
- A failing job shows in PostHog as an error with its kind

## Not in this task

- The jobs that touch money (close day, auto-claims, QRIS): with their features, Steps 30 and 31, using `jobs.Insert`
- Showing the weather in v2: with the screen that needs it
