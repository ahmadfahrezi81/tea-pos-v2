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

**Backend**, at any commit (the previous release's commit to roll back: `git log --first-parent main`):

```bash
infisical run --env=prod --path=/github -- sh -c 'RAILWAY_TOKEN=$RAILWAY_TOKEN node scripts/railway-deploy.mjs <commit> api realtime worker'
```

For staging, use `$RAILWAY_TOKEN_STAGING` instead. It prints each service's Railway link and waits until each is live.

**Frontend:** Cloudflare Pages → the project → Deployments → the previous one → **Rollback**

Migrations only add, so older code runs against the newer schema.
