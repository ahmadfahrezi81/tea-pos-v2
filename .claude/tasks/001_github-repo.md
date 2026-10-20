# Task 001 — The GitHub repo

**Status: approved 2026-10-20; the owner chose a public repo.**

## The goal

A public GitHub repo `tea-pos-v2` that every later step pushes to, with `main` protected from the start.
RFC: Build order Step 1. Modelled on Rail Canvas (its tasks 006 and 007), minus its `staging` branch: here every change is a PR straight into `main`.

## What gets made

1. **Local git repo** in `tea-pos-v2/`, branch `main`. First commit holds only:
   - `.gitignore` (Node, Go, `.env*` except `.env.example`, `.DS_Store`, build output)
   - `README.md`: one paragraph and a link to the RFC
   - `.claude/tasks/` (this file and the task files so far)
   - `.github/rulesets/main.json` (below)
2. **The GitHub repo**, public (the owner keeps repos public), under `ahmadfahrezi81`, created with `gh repo create` (gh is already signed in on the laptop), and the first commit pushed to `main`
3. **Repo settings** (with `gh`):
   - Merge: **squash only**, the PR title as the commit message; auto-delete branches after merge
   - Off: wiki, projects, discussions
   - On: Dependabot alerts, secret scanning and push protection (free on public repos). Being public, a leaked secret is public at once; push protection refuses a push that contains one, and secrets live in Infisical anyway
4. **The `main` ruleset**, kept in git as `.github/rulesets/main.json` and applied with `gh api` (Rail Canvas imported it by hand and did not keep it; keeping it in git means a change to the rules is itself reviewed):
   - Changes only through a PR; no review required (one person)
   - No direct push, no force push, no deletion; no bypass, the owner included
   - Squash merge only
   - **Required checks: none yet.** GitHub refuses a check name that has never run, so Step 5 (CI) adds them to this file in the same PR that creates them

## Order matters

The first commit is pushed **before** the ruleset is applied: with the ruleset on, `main` only accepts PRs, and an empty repo has no `main` to open one against.

## Owner's part

- Review this file
- Answer the open question below
- Nothing to click: everything goes through `gh`. The ruleset is checked afterwards in GitHub → Settings → Rules

## Open question

- **Commit trailer:** Rail Canvas's `CLAUDE.md` said no `Co-Authored-By` line in commits. Same for this repo?

## Done when

- `gh repo view` shows a public `tea-pos-v2` with the first commit on `main`
- A direct `git push` to `main` is refused
- `.github/rulesets/main.json` matches what GitHub shows

## Not in this task

The repo skeleton (pnpm, Turbo, packages, `CLAUDE.md`) is Step 3; CI is Step 5.
