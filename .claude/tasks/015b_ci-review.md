# Task 015b — CI strategy: test each change once, deploy in order, show it on the PR

**Status: built 2026-10-24, not committed: the owner reviews the code first. Part 1 is on PR #31; part 2 (option C) is in the working tree on the same branch. Proven on staging, one piece at a time: Railway's API deploys a service at an exact commit (`scripts/railway-deploy.mjs`, the `worker` live in 32-42 s); the shared comment template renders and edits one comment from start to a failure (a fake GitHub API); the plan step's change detection on this PR's own diff (config changed, no API, no apps, no migrations); actionlint with shellcheck over every workflow. **Found while building:** in Railway's config, leaving a service's branch out means the default branch, `main`, not "no auto deploy": staging's `worker` briefly had a trigger on `main` (reverted at once; nothing was pushed to `main` meanwhile). Railway can only express "no auto deploy" as a trigger on a branch nobody pushes, so every service now names `railway-manual`; staging's `worker` already runs that way. The first real run of `deploy.yml` is this PR's merge into staging (config, then e2e; no API or apps change); the API and apps steps first run on the next PR that changes them. Still to do after merge: apply both rulesets, the RFC's CI/CD section.**


## The goal

**Test each change once, at its PR, against exactly what will merge. Deploy in the RFC's order (migrations → API → apps), and show every step on the PR that caused it.** The CI's layers are all in place (Steps 5-15); its shape is fixed now, before feature work builds on it.
RFC: CI/CD (Testing by level), Testing.

## What we found (2026-10-24)

1. **About a third of all runs were repeats** (206 runs, about 30 PRs): `ci` ran on the branch push and again on the PR (about 26), and again after each merge (about 34)
2. **Railway's Wait for CI waits for every GitHub Actions run on a commit, and a failed one skips the deploy** (Railway's docs). So any push-started job that waits for Railway deadlocks with it: e2e after a merge, and the production check of part 1, which would have held every release for 30 minutes and then failed it
3. **Railway's GitHub deployment reports** (what a non-push trigger would listen to) fire 6-10 times per deploy, staging and production alike, "success" twice: skipped rows and duplicate runs. GitHub cannot listen to one environment's success only
4. **Production's apps deploy on the merge, in parallel with the API.** With a migration the API waits for the owner's approval, so new apps can call an API that is not there yet
5. **After a merge nothing shows on the PR;** the deploy is somewhere in the Actions tab

## Part 1, built (PR #31)

- `ci` on PRs only; `staging` requires a PR to be up to date, so its checks ran on exactly what merges
- `e2e` on release PRs (waiting for staging to run the release's API), with a results table; the benchmark beside it (3 runs, median, slow-phone row, never blocking); `pnpm bench` 3 runs by default
- actionlint with shellcheck in `checks`; a timeout on every job
- A real run on GitHub (throwaway PR #32, closed): e2e passed in 39 s, the benchmark in 1 min 8 s

## Part 2: option C, one deploy workflow per environment

**Railway stops deploying by itself; `deploy.yml` tells it what to deploy, in order.** Railway's API has `serviceInstanceDeployV2(commitSha, environmentId, serviceId)`; the project tokens can call it.

| When | `deploy.yml` runs, in order |
| --- | --- |
| **Merge into `staging`** | migrations → API services at this commit, wait for `/health` → apps → **e2e** |
| **Release merge into `main`** | migrations (**the owner's Approve**) → API services at this commit, `backup` too → apps → **the production check** |

| When | What else runs |
| --- | --- |
| **Push to a PR** | `ci`, dependency review, CodeQL, previews if the apps changed, the migrations dry run if migrations changed (unchanged) |
| **Release PR** | `ci`, `release-source`, the Railway plan, the benchmark, and **`e2e`: the result of staging's last deploy of exactly this code**, not a new run (it runs again only if that result is missing or stale) |

**What this changes from part 1:** e2e moves back to right after each staging deploy (one run, no noise, a step of the same workflow), so a breakage shows minutes after the merge; the release PR reads that result. The production check and the apps move into the release's deploy, after the API. `pages.yml` keeps only previews; `migrations.yml` keeps only the PR dry run; `release.yml` only tags.

**Seeing it, on the PR (owner's question):**
1. **A live comment on the merged PR**, edited as each step finishes: "Deploy to staging · `abc1234`" with migrations, API, apps, e2e as ✅ / ⏳ / ⏸ / ❌, ending with the e2e table, or the failed step and a link. The release PR gets "Deploy to production" the same way, from "waiting for your Approve" to the production check. GitHub notifies the PR's author of each update (the phone app too)
2. **One job per step** (migrations → api → apps → e2e), so the run page draws them as boxes filling in live
3. **A ✅ / ❌ check on the merge commit**, beside it on the branch and in the PR's commit list

**What the comments say** (each edited in place, newest state first):

| | Deploy to staging (on the merged PR) | Deploy to production (on the release PR) |
| --- | --- | --- |
| **Header** | commit, total time so far, overall ✅ / ⏳ / ❌ | the version (`2026.10.N`, linked to its GitHub Release), commit, total time |
| **Migrations** | which ran, by file name, or "none" | "⏸ waiting for your Approve" with a link to the approval page, then which ran |
| **API** | each service at the commit, with its time and a link to its Railway deployment; "not changed" when the merge touched no API | the same, `backup` included |
| **Apps** | both, with their addresses | both, with `tea-pos.` and `tea-office.lykostech.app` |
| **Then** | the e2e table (every test, ✅ / ❌, time) | the production check table |
| **On failure** | the failed step's last 20 log lines, folded, and the run link | the same, plus the rollback line: the previous release's commit and the one command that redeploys it (runbook) |

**Suggestion, strike out if not wanted:** the release PR's benchmark comment also shows the previous release's numbers beside today's (read from the previous release PR's comment), e.g. "app ready 0.82 s (last release 0.80 s, +3%)", so a slowdown stands out without opening the log.

**The rule this gives: everything about a change shows on its PR.** Checks before the merge, the deploy and e2e after it. The Actions tab is for digging into a failure.

## The plan (part 2)

1. **`railway.ts`:** each service's repo stays connected but no branch triggers a deploy, and Wait for CI is off (`checkSuites: false`). **First proven on staging's `worker` alone** that a service with no branch still deploys by `serviceInstanceDeployV2`; if Railway needs a branch for that, the fallback is to keep the branch and turn its auto deploy off in the way Railway supports, written down before going on
2. **`scripts/railway-deploy.sh`:** deploys the given services at a commit through the API and waits until each deployment is `SUCCESS` (or fails with its status), so the workflow and a person by hand use the same steps
3. **`deploy.yml`:** on push to `staging` and `main`; jobs `migrate` → `api` → `apps` (calls `pages.yml`) → `e2e` (staging) or `check` (production); `concurrency` per environment, never cancelling a deploy halfway. Its live comment through `.github/actions/pr-comment`, on the PR the commit came from
4. **The release PR's `e2e` check** reads the staging deploy's e2e result for the PR's head commit (a commit status the staging `e2e` job sets); every merge deploys (an apps-only one skips the API step), so the result exists; only if it is missing (a deploy still running, or one that failed before e2e) does it wait or run the suite itself
5. **Remove** `production.yml`, the main push from `pages.yml` and `migrations.yml`, the production check from `release.yml`
6. **`docs/runbook.md`:** deploying by hand (`scripts/railway-deploy.sh`) and rolling back (deploy the previous commit the same way)
7. **RFC and `CLAUDE.md`:** the two tables above, and the rule

## Owner's part

None expected: Railway settings change through `railway.ts`. If Railway needs a dashboard switch for "no auto deploy", I'll write the exact clicks.

## Done when

- A merge into `staging` shows a live "Deploy to staging" comment on its PR, ending ✅ with the e2e table, and no other run starts
- An apps-only merge says "API: not changed" and still runs e2e against the running API
- A failing step's comment shows its last log lines without opening the run
- A deliberately failing e2e shows ❌ at that step on the PR and on the commit
- A release shows "Deploy to production" on the release PR: waiting for the Approve, then API, apps, the production check, ✅
- Railway never deploys by itself (a push with Railway's own deploy would show two deployments of one commit)
- The release PR's `e2e` check passes from staging's result without running the suite again

## Not in this task

Making the jobs themselves faster (caching, splitting `checks`): only if PR checks start to feel slow.
