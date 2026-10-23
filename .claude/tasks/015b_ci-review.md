# Task 015b — CI strategy: test each change once

**Status: built 2026-10-24 (items 1-9), not committed: the owner reviews the code first. Checked: the e2e wait rule against today's staging; the benchmark's Markdown report against staging with the test admin (`BENCH_PROFILE` keeps CI's profile separate from the owner's); the e2e results table from sample output; the production check against production (all five rows green) and against a wrong commit (red, `ok=false`). Found on the last pass: the production check stopped before its comment if an app was down (a failed `curl`/`jq` under GitHub's stop-on-error); now a down app is a ❌ row, checked with both apps unreachable. The benchmark's slow-phone row is labelled "slow phone ≈ app ready + 4.0 s (Galaxy M11)" and is in the log row too. Changed while building: the production check waits up to 30 minutes, since with a migration the API deploys only after the owner's approval. Still to do after merge: apply both rulesets, the RFC's CI/CD section.**



## The goal

**Test each change once, at its PR, against exactly what will merge; test the whole system once per release.** Today each change is tested two or three times. The CI's layers are all in place (Steps 5-15), so its shape is fixed now, before feature work multiplies the waste.
RFC: CI/CD (Testing by level), Testing.

## What ran (2026-10-20 to 2026-10-23: 206 runs, about 30 PRs)

| Runs | What | Verdict |
| --- | --- | --- |
| 60 | `ci` on push: about 26 on PR branches, about 34 after merges into `staging`/`main` | The branch ones duplicate the PR's run; the merge ones re-test what the PR just tested |
| 39 | `ci` on PRs | The one that counts |
| 9 | `e2e` on Railway's deployment reports (7 skipped, 2 identical) | Noise: Railway reports a deploy 6-10 times, "success" twice; GitHub cannot start on one report only |
| about 75 | `security`, `pages`, `release-source`, `railway-*`, `migrations`, CodeQL, Dependabot | Fine: seconds each, or only when their files change |

No single bug: about 7 runs per PR, a third of them repeats.

## The strategy

| When | What runs |
| --- | --- |
| **Push to a PR** | `ci` (checks, integration, docker), dependency review, CodeQL; previews if the apps changed; the migrations dry run if migrations changed |
| **Merge into `staging`** | No tests again. Deploys only: Railway (API), Pages (apps), and migrations or Railway config when they changed |
| **Release PR** | `ci` once, `release-source`, the Railway plan, **`e2e` against `staging`**, and **the benchmark** (information, never blocking) |
| **Release merge** | Deploys only (migrations after approval, Railway, Pages) and the tag, then **a production check** once production runs it |
| **Any time** | `e2e` by hand (Actions → e2e → Run workflow) |

**Two settings make "once" safe:**
1. **`staging` requires a PR to be up to date before it merges** (`strict_required_status_checks_policy: true`), so the PR's checks ran on exactly what lands. When another PR merged first, GitHub shows **Update branch**: one click, then the checks run again on the new base
2. **`e2e` at the release, not after every merge.** The RFC already gates releases on it. A staging breakage then shows at the release PR (or a manual run), not minutes after the merge. In exchange: no deadlock with Railway's Wait for CI and no report noise

## The plan

1. **`ci.yml`:** on `pull_request` only (into `staging` and `main`). No `push` trigger: Railway's Wait for CI then waits only for what still runs on a merge (migrations, Pages), so the API also deploys sooner
2. **`e2e.yml`:** on release PRs and `workflow_dispatch`; no `deployment_status`. Before the suite it waits for `staging` to run the release's code: `/health` must show the newest commit that changed the API (`git log -1 -- api Dockerfile`, Railway's watch paths) or a later one, checked every 15 s for up to 15 minutes, so a release opened right after a merge does not test the old API
3. **`.github/rulesets/staging.json`:** strict on, applied with `gh api`. **`main.json`:** `e2e` required (already in the file), applied too
4. **RFC, CI/CD:** "Testing by level" and the flow diagram replaced by the table above; the RFC's "fast checks on every branch push" (Step 5) becomes "on every PR"
5. **`CLAUDE.md`:** the table in one line per row

## Added in review (2026-10-24)

**Each one runs once, at one moment, for one question; none repeats another:**

| | When | Against | Question it answers |
| --- | --- | --- | --- |
| PR checks | each PR push | the PR's code, in CI | Is this change correct? |
| `e2e` | the release PR | `staging` | Does the whole system work together, with test users? |
| Benchmark | the release PR, after `e2e` | `staging` | Did this release make the app slower? |
| Production check | after the release merge | production | Is production running this release, and answering? |

The production check looks like a repeat of `e2e` but asks something else, on purpose: `e2e` cannot run there (production has no test sign-in and no test users, and nothing writes to production's data). So it only reads what anyone can: the commit `/health` reports and a signed-out `/me`.

6. **`e2e` results as a table:** every test, pass or fail, with its time (from `go test -v`), as the release PR's `e2e` comment and the run's own summary page (so a run by hand shows it too)
7. **The benchmark in CI** (`e2e.yml`, a second job after `e2e`, `continue-on-error`): `pnpm bench --test-user admin@test-a.test` against staging's backoffice, **3 runs, median**, on GitHub's Chrome. It posts a `benchmark` comment with the table and a ready Benchmark log row (Device "CI runner"). **Never required:** a shared runner varies between runs, so its rows are their own series in the log, for spotting a jump from one release to the next, not a pass or fail. `pnpm bench` writes the Markdown when `BENCH_REPORT` is set; on Linux it starts Chrome with `--no-sandbox` (the runner's image blocks Chrome's sandbox)
8. **`pnpm bench` runs 3 times by default**, not 5 (`--runs` still changes it)
9. **The production check** (`release.yml`, a job after the tag): waits up to 15 minutes until production's `/health` shows the release's merge commit, then checks both apps' `/api/health` and that a signed-out `/api/me` answers `not_signed_in` (the API, sessions and forwarder all up). The result goes on the merged release PR as a `production` comment and on the run's summary. A failure is red on the release run and in the comment; nothing is rolled back by itself (the runbook covers that)

## Owner's part

None (the rulesets are applied by command, with your OK).

## Done when

- A push to a PR branch starts one `ci`
- A merge into `staging` starts no `ci` and no `e2e`; the API deploys without waiting for tests
- A PR behind `staging` cannot merge until updated
- The release PR's `e2e` waits for the right API commit, then passes, and is required
- `e2e` runs from the Actions tab by hand (after the next release: GitHub only shows the button for workflows on `main`)
- The release PR shows the `e2e` table and the benchmark table; the benchmark never blocks the merge
- After the merge, the release PR gets a `production` comment with the running commit, green

## Not in this task

Making the jobs themselves faster (caching, splitting `checks`): only if PR checks start to feel slow.
