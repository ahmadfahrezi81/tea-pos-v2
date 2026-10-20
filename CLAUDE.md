# CLAUDE.md

tea-pos v2: the rebuild of tea-pos. Vite and React apps on Cloudflare Pages, Go on Railway, Supabase for the database, login and files. Built for slow Android phones: every choice favours light and fast.

## Quick start

```bash
corepack enable        # once: pnpm comes from package.json's packageManager
pnpm install
pnpm lint
pnpm typecheck
pnpm format            # Prettier, 4 spaces
supabase migration new <name>   # migrations live only here; never name one by hand
```

Go: `cd api && go run ./cmd/api` (reads `.env.example`'s variables from the shell). `pnpm lint` and `pnpm typecheck` cover Go too (`gofmt`, `go vet`, `go build`). Dependencies are added only when they remove real work; today only `klauspost/compress` (gzip).

Node 22 (`.nvmrc`), TypeScript 5 (not 7: `openapi-typescript` needs 5's JavaScript API).

## Layout

```
api/                 Go module: one backend for every app
  cmd/api            REST API and webhooks
  cmd/realtime       WebSocket hub
  cmd/worker         background jobs and schedules
  internal/config    environment, read once, bad values refuse to start
  internal/platform  logging and the HTTP server (graceful shutdown)
  internal/middleware request id, log, recover, gzip, timeout
  internal/handler   HTTP layer
Dockerfile           one image, every program under /app/; Railway picks one by start command
packages/i18n/       translations (en.json, id.json) and t(); a wrong key fails the typecheck
supabase/            migrations (owned here, copied from the old repo) and config.toml
.railway/railway.ts  Railway services for production (main) and staging (staging branch)
.github/             CI, Railway plan and apply, releases, rulesets, the pr-comment action
.claude/tasks/       one plan per build step
```

## Where things live

- **The plan:** the Notion RFC [Next architecture for the tea-pos app suite](https://app.notion.com/p/3f495a715405812eae99d02d37240af8). It holds every decision with its reason and the build order (Step 1 onward). Read the relevant section before starting a step.
- **The how, per step:** `.claude/tasks/NNN_name.md`, NNN = the step number. Use the `task-file` skill.
- The old app is `../tea-pos` (reference for features and business rules only; its architecture rules are replaced by the RFC).

## How we work

- **One step at a time, in build order.** Later steps assume earlier ones exist.
- **Features are vertical slices:** the Go endpoint and its screen together, one PR.
- **No Next.js.** Code copied from the old repo drops its Next.js imports on the way in.
- **Task file first.** Write it, the owner reviews it, then code. Every change, not only big ones.
- **Every change is a PR into `staging`** (the default branch), squash merged; use the `pr` skill. `staging` deploys to Railway's `staging` environment on the staging database.
- **A release is a PR `staging` → `main`,** merged with a **merge commit**, never squash; use the `release` skill. It tags a GitHub Release `YYYY.MM.N`. Neither branch takes a direct push (rulesets in `.github/rulesets/`, applied with `gh api`).
- **Each CI result gets its own PR comment,** edited in place (`.github/actions/pr-comment`, one `section` per result).
- **Ask before pushing or opening a PR.** Local commits are fine.
- **Railway as code** (`.railway/railway.ts`): never change a declared setting in the dashboard (the next apply fails). A release PR that changes it shows production's plan as a comment; merging applies it. Railway drops Wait for CI on a newly created service, so a second apply sets it.
- **Settings outside git** (Cloudflare, Infisical, Supabase, dashboard-only Railway settings) are the owner's to click: write down what to click, never assume it was done.
- **Secrets live in Infisical** (`staging`, `prod`), never in git or the Vite build. The repo is public.

## Writing

- **Commits:** `type(scope): short summary`, as short as possible, no body. **No `Co-Authored-By` or `Claude-Session` lines**, in commits or PRs.
- **PR descriptions:** a few lines: what and why, and the task file.
- **Code comments:** rare, one short line, only where the why is not obvious.
- **Replies to the owner:** short and simple.

## Keep this file updated

Only for structural changes: a new package, layer, rule or command. Not for single endpoints or fixes.
