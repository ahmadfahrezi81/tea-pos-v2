# Task 006 — Railway, branches and Infisical

**Status: done 2026-10-20. PRs #6, #7 into `staging`, release #8 into `main`, GitHub Release `2026.10.1`. `/health` answers with the deployed commit on staging (`api-staging-c60d`, `realtime-staging-4a79`) and production (`api-production-f3625`, `realtime-production-887b`). Changed after the plan: `main` stays the default branch (owner, looks normal to visitors), PRs target `staging`, `release-source` blocks anything else; Railway manages every variable, so Infisical-synced ones are declared as `preserve()`. Open: production lost Wait for CI when its services were created; the next release that changes `.railway/` restores it.**

## The goal

The three Go services running on Railway in Singapore in two environments, `staging` and `production`, their settings kept in git, the `staging` branch flow in place, and every secret managed from Infisical.
RFC: Build order Step 6, Hosting and cost, CI/CD. Pattern from Rail Canvas (its tasks 007 and 016, and Lessons learned).

## The flow (decided 2026-10-20)

Feature branch → PR into **`staging`** (fast checks, integration tests, frontend preview) → merge → Railway's **`staging` environment** deploys it (on the Supabase staging database) → changes collect → **release PR `staging` → `main`** → production. No backend copy per PR.

## The plan

1. **Branches**
   - `staging`, cut from `main`; `main` stays the default branch (changed after the plan, owner's call), PRs target `staging`
   - `.github/rulesets/staging.json`: PR only, `checks` and `docker` required, squash merge, no force push or deletion
   - `main.json`: merge commit only (a squash would give `main` a commit `staging` never had, and the next release would conflict)
   - **`release-source` check** on PRs into `main`: fails unless the PR comes from `staging`; required on `main` (GitHub rules cannot limit the source branch on their own)
   - **GitHub Environment `production`**, with the owner as required approver (made with `gh api`). Production secrets are scoped to it; Step 9's production migrations wait on its approval
   - **`release.yml`:** when a release PR merges into `main`, tags the merge commit `YYYY.MM.N` (the Nth release that month) and creates a GitHub Release with the release PR's body as its notes
2. **`.railway/railway.ts`** (Railway's Infrastructure as Code, SDK `railway@3.16.0` as a root dev dependency)
   - Services `api`, `realtime`, `worker`, one copy each, region `asia-southeast1-eqsg3a`
   - `production` deploys `main`; `staging` deploys the `staging` branch
   - Start commands `/app/api`, `/app/realtime`, `/app/worker`; health check `/health` on `api` and `realtime`
   - **Wait for CI**: a deploy waits for `checks` and `docker`
   - Variables `ENV`, `LOG_LEVEL`, and `GOMEMLIMIT` per service (about 80% of its memory). Secrets come later and are `preserve()`d: Infisical owns their values
   - App Sleeping off (a sleeping service drops WebSockets)
3. **Railway workflows**, as Rail Canvas
   - `railway-plan.yml`: on a release PR that changes `.railway/`, comments production's plan; merging applies it (`railway-apply.yml`)
   - On a push to `staging`, staging's settings are planned and applied in one go (there is no PR to pin a plan to)
   - A plan that deletes anything fails
4. **PR comments start here** (owner's ask): one comment per section, each edited in place on every push
   - **Checks:** `checks` and `docker`, pass or fail, with a link to the run
   - **Railway plan:** only when `.railway/` changed
   - Later steps add theirs: integration tests (8), migrations (9), bundle size (14), previews and end-to-end tests (15)
5. **Two skills** (owner's ask): `pr` (feature PR into `staging`, squash) and `release` (release PR `staging` → `main`, merge commit, change list and migrations). Written already, reviewed with this task
6. **`CLAUDE.md`**
   - "Every change is a PR into `staging`; a release is a PR `staging` → `main`, merged with a merge commit"
   - "Each new CI result gets its own PR comment, edited in place"
   - Railway as code: never change a declared setting in the dashboard; Railway drops Wait for CI on a newly created service, so a second apply sets it

## Owner's part (I cannot click these)

**Railway**
1. New project `tea-pos-v2` (empty)
2. Workspace usage limit: check it is still set from Rail Canvas ($10 hard limit, $5 alert)
3. A second environment named `staging`, created **Empty** (never Duplicate production: it copies secrets)
4. Two project tokens (one reaches one environment): `production` and `staging`
5. After the first apply: **Generate Domain** on `api` and `realtime` in both environments (the Worker reaches them there in Step 11)

**Infisical**
1. Project `tea-pos-v2`, environments `staging` and `prod` (delete `dev`)
2. The two Railway tokens in `prod` as `RAILWAY_TOKEN` and `RAILWAY_TOKEN_STAGING`
3. Secret syncs: `prod` → Railway `production`; `staging` → Railway `staging`; `prod` → this repo's GitHub Actions secrets. Cloudflare joins in Step 11

## Done when

- `staging` is the default branch; a PR into `main` from any other branch fails `release-source`
- `api` and `realtime` answer `/health` with the deployed commit in both environments; `worker` logs `started`
- A merge into `staging` deploys only `staging`; a release PR deploys `production`; both wait for CI
- A release PR changing `.railway/` shows the plan as a comment
- Merging a release PR creates the tag and GitHub Release `YYYY.MM.N` with its notes
- A test variable set in Infisical appears in Railway and in GitHub's secrets

## Not in this task

Dependabot, dependency review, CodeQL and `govulncheck` (Step 16), backups (Step 7), the database (Step 8), migrations by CI (Step 9), the Worker and the `lykostech.app` addresses (Step 11), frontend deploys (Step 14).
