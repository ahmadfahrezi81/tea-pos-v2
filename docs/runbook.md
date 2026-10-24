# Runbook

What to do when something breaks. Keep each answer short and current.

## Restore the database

Backups: one per night at 03:00 WIB, in the private R2 bucket `tea-pos-backups`, kept 14 days. Each is `postgres/YYYY/MM/DD/HHMMSS.dump` (schemas `public`, `auth`, `storage`) plus `.counts.txt` (rows per table at backup time). healthchecks.io emails the owner if a night fails or never reports.

**Into a local Postgres, to look at the data or test a restore:**

```bash
docker build -t tea-pos-backup ops/backup
docker network create restore-net
docker run -d --rm --name restore-db --network restore-net -e POSTGRES_PASSWORD=restore postgres:17
infisical run --env=prod --path=/backup -- docker run --rm --network restore-net \
    -e R2_ACCOUNT_ID -e R2_ACCESS_KEY_ID -e R2_SECRET_ACCESS_KEY -e R2_BUCKET=tea-pos-backups \
    -e TARGET_URL=postgresql://postgres:restore@restore-db:5432/postgres \
    tea-pos-backup restore.sh latest
docker rm -f restore-db && docker network rm restore-net
```

`infisical run` passes the R2 keys from Infisical (Production, `/backup`) without printing them; it needs `infisical login` once, and `.infisical.yaml` links the repo to the project. `restore.sh latest` takes the newest dump; pass a key without `.dump` for an older one. It ends by comparing row counts (every `public` table and `auth.users`) with the backup's and fails loudly if they differ. Tested 2026-10-20: restores cleanly into Postgres 17.

**Into production, after losing data:** stop first. Restoring overwrites what is there. Decide with the owner which night to restore, restore it locally as above, check the data, then restore only the tables that need it.

## Run a backup now

Railway → `production` → `backup` → **Run now**. A redeploy does not run it.

## How a deploy runs

`.github/workflows/deploy.yml`, on every merge into `staging` and every release into `main`, in order: Railway config (if changed) → migrations (production: your Approve on the run) → the API services at that exact commit → the apps → staging: e2e / production: a read-only check. Each step shows live in a comment on the PR the commit came from, with links. Railway never deploys by itself (`railway.ts`).

## Deploy or roll back by hand

**Backend**, at any commit (the previous release's commit and version to roll back: `gh release list`, then `gh release view <version>`):

```bash
infisical run --env=prod --path=/github -- sh -c 'APP_VERSION=<version> RAILWAY_TOKEN=$RAILWAY_TOKEN node scripts/railway-deploy.mjs <commit> api realtime worker'
```

For staging, use `$RAILWAY_TOKEN_STAGING` and `APP_VERSION=staging` instead. It prints each service's Railway link and waits until each is live. Rehearsed on staging 2026-10-24: back one API commit in 1 min 37 s (`/health` showed the old commit), forward again in 42 s.

**Frontend:** Cloudflare Pages → the project → Deployments → the previous one → **Rollback**

Migrations only add, so older code runs against the newer schema.

## Errors, maintenance, outages

**Errors:** PostHog → the environment's project → **Error tracking**. Both apps' errors and every error Go logs, each with the user, the app version and (Go) the request id; search Railway's logs for that `request_id` for the whole request.

**Maintenance:** PostHog → **Feature flags** → `ops-maintenance` → switch it on (100% of users). Within about a minute and a half every seller sees the maintenance screen; admins still get in, to check. Switch it off the same way; the phones come back by themselves.

**An uptime alert** (Better Stack, an email: production's `/api/health` through the app's address, every 3 minutes from four regions):

1. `curl https://api-production-f3625.up.railway.app/health`: answers means Railway and Go are up, so the forwarder or Cloudflare is the problem (Cloudflare Pages → `tea-pos` → Functions logs)
2. No answer: Railway → `production` → `api` → Deployments and logs. A crash loop after a release: roll back (above)
3. Go up but errors: Supabase's status page and dashboard (the database is the usual cause)

**Too old an app:** a release that breaks older apps adds `MIN_APP_VERSION: "seller@2026.11.2"` (comma-separated per app) to `api` in `.railway/railway.ts`. Older apps get 426 and update themselves.
