# Task 076 — Weather fetched by v2 in production

**Status: planned 2026-11-21, waiting on the owner's review. Before chat's rain alerts (Step 74).**

## The goal

Step 76 of [RFC: Chat (v2)](https://app.notion.com/p/40595a71540581e7b86edc272f66b0c1): the worker's weather job runs in production, and the old cron website stops calling v1's `/api/cron/weather/fetch` and `/api/cron/weather/realtime`. v1 keeps showing the weather exactly as today.

## Why v1 does not notice

v1 reads only `weather_hourly` (its fixed point, Ciomas). v2's job already writes that table for the same point, with the same key `(date, hour)`, place, city and rounding. Staging has run it this way since task 017.

## The plan

1. **One fix first:** Tomorrow.io answers with the current reading and an hourly forecast that also starts at this hour.
   - `weather_hours` keeps the reading (`observed`).
   - `weather_hourly` has no such guard, so the forecast hour can overwrite the reading.
   - Fix: in `fetchCell`, write the v1 row for the current hour only from the reading, as v1's `realtime` call did.
2. **The schedule** (`api/internal/jobs/jobs.go`): production `Every(20*time.Minute)`. Store cells are fetched from an hour before opening to closing, and Ciomas from 05:00 to 22:00. That is at most 24 calls an hour, within the free plan.
3. **Switch-over:** merge and release, check that the worker logs `weather fetched` every 20 minutes, and only then turn off the old website's two jobs. Running both for a while is harmless: they write the same rows.

## Owner's part

- Check that Infisical `prod` has `TOMORROW_IO_API_KEY` (the worker reads it from api's variables).
- After the release, turn off both jobs on the cron website.

## Done when

- Production's worker fetches every 20 minutes.
- v1's weather drawer shows today's hours after the website's jobs are off.

## Not in this task

Rain alerts in chat (Step 74, built on this job).
