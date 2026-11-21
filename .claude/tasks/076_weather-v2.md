# Task 076 — Weather fetched by v2 in production

**Status: built 2026-11-21 on `feat/weather-v2`. Integration test passes (v1's table keeps the reading for the current hour). One real call to Tomorrow.io from the laptop with staging's key (writing nothing) answered 26 hours, one of them the reading. Switch-over waits for the release.**

## The goal

Step 76 of [RFC: Chat (v2)](https://app.notion.com/p/40595a71540581e7b86edc272f66b0c1), and the main RFC's Step 45 as task 017 planned it. The worker's weather job runs on its schedule, and the old cron website stops calling v1.

## Why v1 does not notice

v1 reads only `weather_hourly`, for its fixed point (Ciomas). The worker writes that table for the same point, with the same key `(date, hour)`, place, city and rounding.

This is proven by the integration test against a fake Tomorrow.io, not by a run: the job has never run on a schedule anywhere. Both lines were `nil` since task 017, waiting for this switch.

## The plan

1. **One fix:** Tomorrow.io answers with the current reading and an hourly forecast that starts at this same hour.
   - `weather_hours` keeps the reading (`observed`).
   - `weather_hourly` has no such guard, so the forecast could overwrite the reading.
   - Now the v1 row for the current hour comes only from the reading, as v1's `realtime` call did.
   - `TestWeatherByArea` checks it.
2. **The schedules** (`api/internal/jobs/jobs.go`):
   - Production every 20 minutes. Only cells with a store open, or opening within the hour, are fetched; Ciomas from 05:00 to 22:00. That is at most 24 calls an hour on the free plan's 25.
   - Staging once a day at 21:00, every cell, as task 017 planned.

## Owner's part

- **Never both fetching** (owner, task 017), on the cron website (console.cron-job.org). Both schedules share one key and the free plan's 25 calls an hour.
  - When this PR merges into `staging`: delete staging's 21:00 call.
  - Within the hour after the release deploys: delete production's hourly forecast and its 20-minute current weather.
- `TOMORROW_IO_API_KEY` is in Infisical `prod` and `staging` `/app` (checked 2026-11-21).

## Done when

- Production's worker logs `weather fetched` every 20 minutes.
- v1's weather drawer shows today's hours.
- The cron website has no weather jobs.

## Not in this task

Rain alerts in chat (Step 74, built on this job).
