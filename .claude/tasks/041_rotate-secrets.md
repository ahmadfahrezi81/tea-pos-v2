# Task 041 — Rotate secrets after Railway's incident

**Status: done 2026-10-23. Part 1 on 2026-10-22 (database passwords, R2 token, production and GitHub checks clean). Part 2 on 2026-10-23: GitHub reconnected in Railway; the four project tokens made again (no account token existed); new `EDGE_SECRET`s and healthchecks.io ping URL, the same in Infisical, Railway and GitHub; staging redeployed through PR #19, production through release 2026.10.3; every service logs `database connected`; the backup ran by hand and uploaded. Rail Canvas is not rotated: it is shut down instead (RFC Step 42).**


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
