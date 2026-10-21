# Task 011 — Pages and the `/api` forwarder

**Status: PR #14 open 2026-10-21. First deploy created both Pages projects; `tea-pos` was taken on `pages.dev`, so the seller project's address is `tea-pos-d8i.pages.dev` (`tea-office` kept its name). Both PR previews serve the placeholder, their `/api/health` answers from staging's API through the forwarder, and Cloudflare offers HTTP/3 (`alt-svc: h3`). Left after merge: the `staging` alias deploy, the custom domains (owner), and the Go secret check once Railway builds again.**

## The goal

`tea-pos.lykostech.app` and `tea-office.lykostech.app` (and their `-staging` twins) serve a placeholder page from Cloudflare Pages, and each one's `/api/*` reaches the Go API on Railway, so the apps never call another address (no CORS) and sign-in in Step 12 has its callback address.
RFC: Build order Step 11, principle 9, Railway notes (Address).

## Decided while planning: Pages Functions, not a separate Worker

A **Pages Function** (`functions/api/[[path]].ts`) is a Worker that runs inside the Pages project, on the same address as the app. Unlike a separate Worker on a route, it also runs on every **preview** (`*.pages.dev`), so previews sign in like production. Same free allowance (100,000 requests a day).

## The plan

1. **`packages/edge`**: the forwarder, about 30 lines
   - `/api/<path>` → `<API_ORIGIN>/<path>` (the `/api` prefix is dropped: Go's routes stay `/health`, `/me`, ...)
   - Adds `X-Edge-Secret` and the caller's real IP (`X-Client-IP`, from Cloudflare's `CF-Connecting-IP`)
   - Passes method, body, cookies and the response through unchanged
2. **`apps/seller` and `apps/backoffice`**, placeholders until Step 14: an `index.html` ("tea-pos v2, coming soon") and `functions/api/[[path]].ts` re-exporting the forwarder
3. **Go: `middleware.Edge`**: a request without the right `X-Edge-Secret` gets 404 (Railway's own address leads nowhere), except `/health` so Railway's health check still works. `realip` reads `X-Client-IP` only from a request that passed the secret check
4. **Deploys from GitHub Actions** (`pages.yml`) with `wrangler pages deploy`:
   - a PR → a preview of both apps (`<branch>.tea-pos.pages.dev`), API = staging
   - a push to `staging` → the `staging` alias, API = staging
   - a push to `main` → production, API = production
   - the preview links go into their own PR comment
5. **`API_ORIGIN` per environment** is plain config in `pages.yml`, not a secret: production `api-production-f3625.up.railway.app`, everything else `api-staging-c60d.up.railway.app`
6. **`EDGE_SECRET`** comes from Infisical: synced to Railway `api` (declared `preserve()` in `railway.ts`; `realtime` references it), and set on the Pages projects by `pages.yml` at every deploy from GitHub's secrets (no Infisical → Pages sync needed)
7. **`CLAUDE.md`:** the forwarder, the secret header, how deploys map to environments

## Found in the sanity pass

- **Order:** once Go checks the header, `EDGE_SECRET` must be in Railway and Pages first, or every `/api` call answers 404. So Go refuses to start without it, and the Infisical part happens before the merge (as with `DATABASE_URL`)
- **Names:** Pages project names are global; if `tea-pos` or `tea-office` is taken, `tea-pos-v2` and `tea-office-v2` (only the `pages.dev` address changes)
- **Staging addresses:** Pages may need the custom domain added in the project as well as the DNS record; checked during the build
- **HTTP/3:** checked through Cloudflare's `alt-svc` header, as the laptop's `curl` may lack HTTP/3
- **Previews only for PRs from this repo:** forks get no secrets

## Owner's part

**Cloudflare**
1. An **API token**: Account → Cloudflare Pages: Edit. Put it and the **account id** in Infisical Production `/github` (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`), so GitHub gets them
2. After the first deploy creates the projects `tea-pos` and `tea-office`: **Custom domains** → `tea-pos.lykostech.app` and `tea-office.lykostech.app` (production)
3. The two staging addresses: DNS → a `CNAME` `tea-pos-staging` → `staging.tea-pos-d8i.pages.dev`, and `tea-office-staging` → `staging.tea-office.pages.dev`, proxied. I confirm during the build that Pages serves a branch alias on a custom name this way

**Infisical**
1. `EDGE_SECRET` in Staging `/app` and Production `/app`: a long random value each (`openssl rand -hex 32`), different per environment. The existing `/app` → Railway `api` syncs carry it
2. The same two values in Production `/github` as `EDGE_SECRET_STAGING` and `EDGE_SECRET_PRODUCTION` (the `github-ci` sync sends them to GitHub; `pages.yml` puts them on Pages)

## Done when

- `https://tea-pos.lykostech.app` shows the placeholder over HTTP/3 (checked with `curl --http3`)
- `https://tea-pos.lykostech.app/api/health` answers from production's API; the `-staging` twin and a PR preview answer from staging's
- Railway's own address answers 404 to anything but `/health`
- A PR shows its preview links in a comment

## Not in this task

The real apps (Step 14), the WebSocket path to `realtime` (Step 26), Railway redeploys still blocked by the outage: the Go change (`middleware.Edge`) goes live when Railway builds again; until then the forwarder works against what is deployed.
