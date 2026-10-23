# Task 009 — Migrations by CI

**Status: built 2026-10-23, waiting on the owner's Infisical clicks. Steps 8 and 11 are done and Railway builds again, so nothing blocks it. Step 12 (PR #18, the sessions table) merges after it and is its first real migration.**

## The goal

A migration reaches the staging database when its PR merges into `staging`, and production's when a release merges into `main`, after one approval click. Nobody runs `supabase db push` by hand again, except in an emergency.
RFC: Build order Step 9; Database during the transition (how a migration is applied, the safety rules).

## Checked first

`supabase migration list` against both databases, on 2026-10-21 and again on 2026-10-23 with the new passwords: the history tables of **staging and production match our 68 files exactly**. Safe to let CI push.

## Changed since the first plan

- **Tests already see a PR's migration**, through Step 12's `db/pending.sql` (`scripts/pending.sh`, from the `-- migrations through:` marker that `db-schema.sh` writes; sqlc and `testkit` load it after `schema.sql`; `generate:check` fails if it is stale). The first plan's items 2 and 3 are dropped here: Step 12 brings them
- **The production database password is only in Infisical** since Step 41, so the workflow reads it from there by reference, never a copy
- **GitHub's `production` environment already exists** with required reviewers (the owner) and a branch policy; no workflow uses it yet

## The plan

1. **`.github/workflows/migrations.yml`**, only when `supabase/migrations/**` changes:
   - **On a PR into `staging`:** `supabase db push --dry-run --db-url` against staging; the migrations that would run go into its own PR comment section (`migrations`). Skipped for Dependabot (no secrets)
   - **On a push to `staging`:** `supabase db push` against staging
   - **On a push to `main` (a release):** the same against production, in the GitHub Environment **`production`**, so it waits for the owner's **Approve**. Railway's Wait for CI waits for this run too, so the API never deploys before its migration, on staging as on production
   - One run at a time per database (`concurrency`, never cancelled halfway); `permissions: contents: read` (plus `pull-requests: write` for the comment)
   - Supabase CLI pinned (`supabase/setup-cli`, 2.121.0)
2. **Database URLs as GitHub secrets, scoped:** `STAGING_DATABASE_URL` as a repository secret; `PRODUCTION_DATABASE_URL` only in the **`production` environment**, so no job outside the approved one can read it (not a PR, not another workflow)
3. **`CLAUDE.md`:** the rules from the RFC: CI is the only pusher; create migrations only with `supabase migration new`; never edit one that has run; backfills harmless twice; after a migration reaches staging, the next PR reruns `db:schema` (until then `pending.sql` carries it)

## Owner's part

**Infisical, Production**, as references so a rotated password changes one place:
- In `/github`: `STAGING_DATABASE_URL` = `${staging.app.DATABASE_URL}` (the existing sync carries it to the repository)
- A new folder **`/github-production`**: `PRODUCTION_DATABASE_URL` = `${prod.app.DATABASE_URL}`. Its own folder, because the `/github` sync copies everything in it to the repository's secrets

**Infisical, a second GitHub sync:** source Production `/github-production`, destination the repository's **environment `production`** (scope: Repository Environment). Then check GitHub: Settings → Environments → `production` lists `PRODUCTION_DATABASE_URL`; Settings → Secrets → Actions does not.

**From now on:** stop running `supabase db push` yourself, for both databases.

## Done when

- This PR touches no migration, so its own run is skipped; the first PR that does (Step 12) shows the dry run in a comment
- Step 12's sessions table reaches staging on merge (before staging's API deploys), and production on a release, after the approval
- Pushing the same migrations twice changes nothing
- `PRODUCTION_DATABASE_URL` is not in the repository's secrets, only the environment's

## Not in this task

The first migration itself (Step 12). Reverting a bad migration is a new migration, never a rollback.
