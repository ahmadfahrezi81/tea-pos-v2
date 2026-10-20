# Task 005 — CI fast checks

**Status: done 2026-10-20, PR #5. `checks` and `docker` green on the PR (the Dockerfile's first build); badly formatted Go fails `pnpm lint` (checked locally, same command CI runs); the `main` ruleset now requires both checks.**

## The goal

Every push to any branch runs the fast checks on GitHub Actions, and `main` only accepts a PR whose checks are green.
RFC: Build order Step 5, CI/CD.

## The plan

1. **`.github/workflows/ci.yml`**, on every push to any branch and on PRs into `main`. Two jobs, in parallel:
   - **`checks`**: Node 22 and pnpm (from `packageManager`), Go (from `api/go.mod`), then `pnpm install --frozen-lockfile`, `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`. Turbo runs JavaScript and Go alike
   - **`docker`**: builds the `Dockerfile`, pushes nothing. It has never been built yet (Docker is off on the laptop), so this is its first real test
2. **A new push cancels the older run on the same branch**, so only the latest commit is checked
3. **`test` joins Turbo** (`turbo.json`, root `package.json`); today only Go has tests to run, and none yet
4. **Action versions pinned** to major tags (`actions/checkout`, `actions/setup-node`, `actions/setup-go`, `pnpm/action-setup`)
5. **The `main` ruleset requires `checks` and `docker`**: added to `.github/rulesets/main.json` and applied with `gh api`, **after** this PR's checks have run once (GitHub refuses a check name it has never seen)

## Owner's part

- Review this file
- Nothing to click

## Done when

- This PR shows `checks` and `docker` green
- A follow-up push of a broken format or failing `go vet` turns `checks` red (tried once on a throwaway branch, then deleted)
- The ruleset lists both as required, and GitHub shows them as required on the next PR

## Not in this task

Integration tests, PR environments, previews and end-to-end tests (Steps 8 and 15), the bundle-size check (Step 14, when there is a bundle), the PR comment (Step 15).
