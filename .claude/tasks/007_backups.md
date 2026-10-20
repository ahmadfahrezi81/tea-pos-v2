# Task 007 — Backups

**Status: built 2026-10-20 (code, uncommitted to `staging` yet), waiting on the owner's clicks. Then: the release that creates `backup` in production, the first night's run, and the test restore.**

## The goal

Production's database is dumped every night to storage outside Supabase, a missed night emails the owner, and one restore has been proven to work.
RFC: Build order Step 7. Shape from Rail Canvas (its task 009 and `ops/backup/`).

## What we found (2026-10-20)

- Production (`TEA-POS-PROD`) is on the Free Plan: **no backups at all**; point in time is Pro only
- Postgres 17.6; Storage about 0.10 GB; the dump is small
- Payroll and orders are real money data

## The plan

1. **`ops/backup/`**, its own image (the Go image has no `pg_dump`)
   - `Dockerfile`: `FROM postgres:17` (`pg_dump` refuses a server newer than itself), plus `curl`
   - `backup.sh`: `pg_dump --format=custom` through the pooler in session mode, `pg_restore --list` to prove the file reads, row counts of the main tables, upload both to R2 (`curl --aws-sigv4`, no extra tools), and healthchecks.io pings for start, success and failure
   - `restore.sh`: loads a dump into an empty database, for the test and for a real emergency
   - Never echoes a variable (the database URL holds the password)
2. **A `backup` cron service in `.railway/railway.ts`, production only** (staging's data is fake)
   - `0 20 * * *` UTC = 03:00 WIB; it runs, uploads and exits, so it costs nothing in between
   - `rootDirectory: ops/backup`, rebuilt only when `ops/backup/` changes; no restarts on failure (healthchecks.io reports it instead)
   - Variables declared with `preserve()`: `DATABASE_URL`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `HC_PING_URL`; `R2_BUCKET` is plain text
3. **CI:** the `docker` job also builds `ops/backup/`, and `shellcheck` checks both scripts
4. **One test restore** on the laptop: the newest dump into a local Postgres 17, row counts compared with the counts file. Exact `pg_dump`/`pg_restore` flags for Supabase's own schemas (`auth`, `storage`) are settled here, against a real dump
5. **`docs/runbook.md`:** how to restore, step by step; how to run a backup by hand

## Owner's part (I cannot click these)

**Cloudflare R2**
1. Create a private bucket `tea-pos-backups`
2. A lifecycle rule: delete objects after 14 days
3. An R2 API token with Object Read & Write on that bucket only. Note the account id, access key id and secret

**healthchecks.io**
1. A free account and one check, `tea-pos backup`: period 1 day, grace 1 hour, email alerts on

**Supabase**
1. Production → Connect → **Session pooler** connection string (port 5432), with the database password

**Infisical (Production)**
1. Folder `backup` with `DATABASE_URL`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `HC_PING_URL`
2. A Railway sync: source Production, path `/backup`, to Railway `production`, service `backup` (after the release that creates it)

**Laptop**
1. Docker running (for the test restore), once

## Done when

- The first nightly run uploads a dump and a counts file to R2; healthchecks.io shows green
- A run with a wrong password turns healthchecks.io red and emails the owner (tried once, then fixed)
- The test restore's row counts match production's
- `docs/runbook.md` explains a restore
- Wait for CI set on `backup` (a new service loses it, so a second release that changes `.railway/` restores it, together with production's other services)

## Not in this task

Storage photos (about 100 MB): a dump covers the database only. A weekly bucket copy to R2 is an optional follow-up. Staging gets no backup.
