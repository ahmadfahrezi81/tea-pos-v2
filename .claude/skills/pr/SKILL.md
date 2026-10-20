---
name: pr
description: Open a feature PR into the staging branch. Use when a task's work is ready and the owner OKs pushing, or asks to "open the PR". Not for releases (use the release skill).
---

# Feature PR

Every change reaches `staging` by PR. Releases to `main` use the `release` skill instead.

## Before

- The owner said OK to push (always ask first)
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` pass locally
- The task file's status line is current

## The PR

- **Base: `staging`.** Never `main`
- **Title:** the commit style, `type(scope): short summary`. It becomes the squash commit
- **Body:** 1-3 lines: what and why, then `Task: .claude/tasks/NNN_name.md`. Nothing else
- **No attribution lines** (`Co-Authored-By`, `Claude-Session`, "Generated with"), in commits or the PR

```bash
gh pr create --base staging --title "type(scope): summary" --body "What and why.

Task: .claude/tasks/NNN_name.md"
```

## After

- Read CI through the app's PR tools; never poll
- When green and the owner says merge: `gh pr merge <n> --squash`
- Then mark the task done (status line, RFC Build order tick with date)
