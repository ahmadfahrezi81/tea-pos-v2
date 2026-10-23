# Task 041 — Rotate secrets after Railway's incident

**Status: Part 1 done 2026-10-22. Production and staging database passwords reset (both new URLs connect; Infisical `/app` and `/backup` updated); R2 `tea-pos-backup` token rolled (new secret lists the bucket); production checks clean: only Supabase's own and the dashboard connected, no new `auth.users` since 2026-10-20 (Postgres logs do not record logins on this plan, so they prove nothing either way); GitHub security log shows only the owner's address and GitHub itself; the owner also turned on two-factor and a passkey. Part 2 in progress 2026-10-23: GitHub reconnected in Railway; the four project tokens made again (both reach their environment; Infisical's Railway connection and `/github` updated); new `EDGE_SECRET` per environment and a new healthchecks.io ping URL, same in Infisical, Railway and GitHub. Staging's apply refused to delete `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` (synced for Step 12 ahead of its PR), so `railway.ts` declares them now. Production redeploys with the next release (its code predates the incident, which Railway cannot redeploy).**

## Why

On 2026-10-21 Railway disclosed that decrypted environment variables may have leaked, and asked every user to roll them. Our Railway variables held the production and staging database passwords, the R2 backup keys, the edge secrets and the healthchecks.io ping URL. Railway has since refused our project tokens, so it has likely revoked them.
RFC: Build order, Step 41.

## Part 1, now (owner)

1. **Supabase production:** Project Settings → Database → Reset database password (Generate). New session pooler URL into Infisical Production `/app` and `/backup` as `DATABASE_URL`
2. **Supabase production logs:** Postgres and pooler connections since 2026-10-21; anything from an unknown address gets a screenshot
3. **Cloudflare R2:** delete the `tea-pos-backup` API token, create a new one (Object Read & Write, `tea-pos-backups` only), into Infisical `/backup` (`R2_ACCOUNT_ID` stays, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` change)
4. **Supabase staging:** reset its password the same way; into Infisical Staging `/app`
5. **GitHub:** Settings → Security log, and the repo's Settings → Deploy keys: nothing unexpected

Expected meanwhile: the running services keep the old passwords and stop reaching the database; the nightly backup fails and healthchecks.io emails. Nobody uses v2 yet.

## Part 2, when Railway builds again

1. New `EDGE_SECRET` per environment (`openssl rand -hex 32`), in each `/app` and as `EDGE_SECRET_STAGING` / `EDGE_SECRET_PRODUCTION` in `/github`
2. A new healthchecks.io check (new ping URL) into `/backup`; delete the old check
3. Railway: delete and make again the four project tokens (`github-*`, `infisical-*`) and the account token; update Infisical `/github` and Infisical's Railway connections
4. Redeploy every service (staging and production) so each reads the new values; run the backup by hand; healthchecks.io green
5. Check each service's logs from 2026-10-20 on for anything unusual

## Rail Canvas, this week

Its Railway Postgres password, its R2 backup token, `WEBHOOK_SECRET` and the Telegram secret.

## Done when

- Every value that was in Railway on 2026-10-21 has been replaced, and the old ones no longer work (the old database passwords are refused)
- All services run on the new values; the backup is green again
