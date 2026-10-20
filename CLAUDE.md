# CLAUDE.md

tea-pos v2: the rebuild of tea-pos. Vite and React apps on Cloudflare Pages, Go on Railway, Supabase for the database, login and files. Built for slow Android phones: every choice favours light and fast.

## Where things live

- **The plan:** the Notion RFC [Next architecture for the tea-pos app suite](https://app.notion.com/p/3f495a715405812eae99d02d37240af8). It holds every decision with its reason and the build order (Step 1 onward). Read the relevant section before starting a step.
- **The how, per step:** `.claude/tasks/NNN_name.md`, NNN = the step number. Use the `task-file` skill.
- The old app is `../tea-pos` (reference for features and business rules only; its architecture rules are replaced by the RFC).

## How we work

- **One step at a time, in build order.** Later steps assume earlier ones exist.
- **Task file first.** Write it, the owner reviews it, then code. Every change, not only big ones.
- **Every change is a PR into `main`.** `main` takes no direct push (ruleset in `.github/rulesets/main.json`, changed only by PR). Squash merge.
- **Ask before pushing or opening a PR.** Local commits are fine.
- **Settings outside git** (Cloudflare, Infisical, Supabase, dashboard-only Railway settings) are the owner's to click: write down what to click, never assume it was done.
- **Secrets live in Infisical** (`staging`, `prod`), never in git or the Vite build. The repo is public.

## Writing

- **Commits:** `type(scope): short summary`, as short as possible, no body. **No `Co-Authored-By` or `Claude-Session` lines**, in commits or PRs.
- **PR descriptions:** a few lines: what and why, and the task file.
- **Code comments:** rare, one short line, only where the why is not obvious.
- **Replies to the owner:** short and simple.

## Keep this file updated

Only for structural changes: a new package, layer, rule or command. Not for single endpoints or fixes.
