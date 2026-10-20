# Task 007 — Backups

**Status: outline 2026-10-20. Planned in detail when Step 6 (Railway and Infisical) is done.**

## The goal

Production can be restored if the database is lost or a migration goes wrong, before v2 writes to production.
RFC: Build order Step 7.

## What we found (2026-10-20)

- Production (`TEA-POS-PROD`) is on the **Free Plan: no backups at all** ("Free Plan does not include project backups"; point in time is Pro only)
- After a year: Storage about 0.10 GB of 1 GB, egress 0.12 GB of 5 GB. A nightly dump is tiny
- Payroll and orders are real money data

## The shape (as in Rail Canvas, Step 9 there)

- A **`backup` cron service on Railway** from its own image, `ops/backup/` (the Supabase CLI and `pg_dump` matching Supabase's Postgres major version; the Go image has none). Not in the Go `worker`: a backup must not depend on the app's code being healthy
- **03:00 WIB nightly:** `supabase db dump` as three files (roles, schema, data; `auth` included, so logins survive a restore), through the pooler in session mode
- **Private Cloudflare R2 bucket** `tea-pos-backups`, one folder per night, deleted after 30 days by a lifecycle rule
- **healthchecks.io** ping on start, success and failure; a missed night sends an email
- **One test restore** into a local Supabase, row counts compared with production; restore steps in `docs/runbook.md`
- **Not covered: Storage photos** (about 100 MB). A weekly bucket copy to R2 is an optional follow-up
