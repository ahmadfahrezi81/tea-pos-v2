# Task 009 — Migrations by CI

**Status: planned 2026-10-21, on hold: the owner starts it only once Steps 8 and 11 are solid (both wait on Railway's API, which rejected project tokens on 2026-10-21).**

## The goal

A migration reaches the staging database when its PR merges into `staging`, and production's when a release merges into `main`, after one approval click. Nobody runs `supabase db push` by hand again, except in an emergency.
RFC: Build order Step 9; Database during the transition (how a migration is applied, the safety rules).

## Checked first (2026-10-21)

`supabase migration list` against both databases: the history tables of **staging and production match our 68 files exactly**. Safe to let CI push.

## The plan

1. **`.github/workflows/migrations.yml`**, only when `supabase/migrations/**` changes:
   - **On a PR into `staging`:** `supabase db push --dry-run` against staging; the list of migrations that would run goes into its own PR comment section (`migrations`)
   - **On a push to `staging`:** `supabase db push` against staging
   - **On a push to `main` (a release):** the same against production, in the GitHub Environment **`production`**, so it waits for the owner's **Approve**. Railway's Wait for CI waits for this run too, so the production API never deploys before its migration
   - One run at a time per database (`concurrency`), never cancelled halfway
   - Supabase CLI pinned (`supabase/setup-cli`, 2.121.0)
2. **Tests see new migrations before the dump does.** `api/db/schema.sql` is dumped from staging, so a PR's new migration is not in it yet. `db-schema.sh` writes the newest migration it includes as a first-line comment; `testkit` loads the dump, then every migration file newer than that line. After the merge, `pnpm --filter @tea-pos/api db:schema` in the next PR catches the dump up
3. **A check that the dump is not left behind:** `checks` fails if a migration file is newer than the dump's marker *and* the PR does not add that migration (the dump is out of date on `staging`)
4. **`CLAUDE.md`:** the rules from the RFC: CI is the only pusher; create migrations only here with `supabase migration new`; never edit one that has run; backfills harmless twice; regenerate `schema.sql` after a migration lands on staging

## Owner's part

**Infisical, Production `/github`:**
- `STAGING_DATABASE_URL` and `PRODUCTION_DATABASE_URL`, the session pooler strings (the same values as each `/app`). Infisical's secret references (`${staging.app.DATABASE_URL}`, `${prod.app.DATABASE_URL}`) keep one source; plain copies also work

**From now on:** stop running `supabase db push` yourself, for both databases.

## Done when

- A PR touching migrations shows the dry run in a comment ("Remote database is up to date" today)
- The first real migration (Step 12's sessions table) reaches staging on merge and production on a release, after the approval
- Pushing the same migrations twice changes nothing

## Not in this task

The first migration itself (Step 12). Reverting a bad migration is a new migration, never a rollback.
