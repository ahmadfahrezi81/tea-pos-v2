# Task 008 — Database

**Status: built 2026-10-21, PR open, not merged. Schema dumped from staging (26 tables); `GetTenantBySlug` integration test passes locally against Postgres 17; the API connects to the staging database from the laptop (`database connected`). Found while building: the dump creates `public` itself and sets an empty `search_path`, and the policies call `auth.role()` as well as `auth.uid()`; `testkit` and `stubs.sql` handle all three. Fixtures are two tenants for now (stores join with their slice). Left: apply `.github/rulesets/staging.json` (adds `integration` as required) after this PR's checks run; merge; staging logs `database connected` on all three services; release.**

## The goal

Go talks to Supabase Postgres with typed queries, CI runs integration tests on a throwaway database built from the real schema, and the first test passes.
RFC: Build order Step 8, Data and platform.

## Found while planning

**The migrations cannot build the database from scratch.** The base tables (`tenants`, `users`, `stores`, `orders`, ...) were made in the dashboard before migrations existed; the first migrations already rename and alter them. So the RFC's "CI runs a local Supabase with the real migrations" would fail. Instead, the **schema dump is the source of truth** for tests and sqlc, as `pnpm types:db` is today. Migrations stay what changes the real databases (Step 9). Lighter too: CI needs a plain `postgres:17`, not the Supabase stack.

## The plan

1. **`api/db/schema.sql`**, generated, never edited: `pnpm --filter @tea-pos/api db:schema` dumps the **staging** database's `public` schema (structure only, no data) with `pg_dump --schema-only --no-owner`. Rerun after every migration
2. **`api/db/stubs.sql`**, hand-written and small: what `schema.sql` refers to but a plain Postgres lacks: the `auth` schema with `auth.users (id)` and `auth.uid()`, and the roles `anon`, `authenticated`, `service_role`
3. **sqlc** (pinned, run with `go run`, nothing installed globally): reads `stubs.sql` + `schema.sql`, queries in `api/db/queries/*.sql`, typed Go out to `api/internal/store/` (generated, never edited)
4. **`internal/platform/db.go`**: a pgx pool from `DATABASE_URL` (session pooler), fixed size from `DB_MAX_CONNS` (`api` 8, `worker` 4, `realtime` 2, set in `railway.ts`), pinged at start: a program that cannot reach the database refuses to start. `/health` still does not touch it
5. **Tests**
   - `api/tests/testkit/`: creates a throwaway database, loads `stubs.sql`, `schema.sql` and the fixtures, gives a test its pool
   - `api/tests/fixtures/base.sql`: two tenants (grows with each slice)
   - `api/tests/integration/tenants_test.go`, build tag `integration`: the first query (`GetTenantBySlug`) returns the right tenant and never the other one
6. **CI**
   - New job **`integration`** on PRs: a `postgres:17` service, then `go test -tags integration ./tests/...`. Required on `staging`. Its own PR comment section
   - `checks` also fails if `internal/store/` is out of date with the SQL (`sqlc diff`)
7. **Laptop:** `infisical run --env=staging --path=/app -- go run ./cmd/api` runs the API against the staging database; `pnpm --filter @tea-pos/api test:integration` runs the tests against a local Postgres (OrbStack)
8. **Railway:** `DATABASE_URL` declared as `preserve()` on `api` (Infisical syncs it there); `realtime` and `worker` reference `api`'s value (`api.env.DATABASE_URL`), as Rail Canvas did. `DB_MAX_CONNS` set per service
9. **`CLAUDE.md`:** the commands, "migrations change the databases; `schema.sql` describes them; regenerate it after every migration"

## Owner's part

**Supabase staging:** Connect → Session pooler string, with the password (test it with `psql` as for production)

**Infisical**
1. Folder `app` in **Staging** and in **Production**, each with `DATABASE_URL` (that environment's session pooler string)
2. Two syncs to Railway, **before this PR merges** (a service without `DATABASE_URL` refuses to start; `railway.ts` then keeps the synced value with `preserve()`): Staging `/app` → Railway `staging`, service `api`; Production `/app` → Railway `production`, service `api`. Subfolders off, prevent deletion on. `realtime` and `worker` read it from `api` through `railway.ts`

## Done when

- `integration` is green on this PR and required on `staging`
- Staging `api`, `realtime`, `worker` log `database connected` with their pool size
- Changing a query without regenerating fails `checks`
- `schema.sql` matches the staging database

## Not in this task

Applying migrations by CI (Step 9), any endpoint (Step 10 on), RLS-aware connections (v2 connects as `postgres`, see RFC).
