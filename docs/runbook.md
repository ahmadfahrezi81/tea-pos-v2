# Runbook

What to do when something breaks. Keep each answer short and current.

## Restore the database

Backups: one per night at 03:00 WIB, in the private R2 bucket `tea-pos-backups`, kept 14 days. Each is `postgres/YYYY/MM/DD/HHMMSS.dump` (schemas `public`, `auth`, `storage`) plus `.counts.txt` (rows per table at backup time). healthchecks.io emails the owner if a night fails or never reports.

**Into a local Postgres, to look at the data or test a restore:**

```bash
docker build -t tea-pos-backup ops/backup
docker run -d --name restore-db -e POSTGRES_PASSWORD=restore -p 55432:5432 postgres:17
docker run --rm --network host \
    -e R2_ACCOUNT_ID -e R2_BUCKET=tea-pos-backups -e R2_ACCESS_KEY_ID -e R2_SECRET_ACCESS_KEY \
    -e TARGET_URL=postgresql://postgres:restore@localhost:55432/postgres \
    tea-pos-backup restore.sh latest
docker rm -f restore-db
```

The R2 values come from Infisical (Production, `/backup`). `restore.sh latest` takes the newest dump; pass a key without `.dump` for an older one. It ends by comparing row counts with the backup's and fails loudly if they differ.

**Into production, after losing data:** stop first. Restoring overwrites what is there. Decide with the owner which night to restore, restore it locally as above, check the data, then restore only the tables that need it.

## Run a backup now

Railway → `production` → `backup` → **Run now**. A redeploy does not run it.

## Roll back a deploy

- **Backend:** Railway → the service → Deployments → the previous one → **Redeploy**
- **Frontend:** Cloudflare Pages → the project → Deployments → the previous one → **Rollback**

Migrations only add, so older code runs against the newer schema.
