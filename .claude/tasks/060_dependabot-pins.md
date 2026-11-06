# Task 060 — Dependabot keeps TypeScript 5 and Node 22's types

**Status: approved 2026-11-06; pins merged (#105), security bump in PR.**

## The goal

Dependabot's npm PR (#101) bumps TypeScript 5 to 7 and `@types/node` 22 to 26. CLAUDE.md keeps TypeScript on 5 (`openapi-typescript` needs its JavaScript API) and Node on 22 (`.nvmrc`), so `checks` fails (`typescript-eslint does not support TS 7.0`) and the other 12 bumps are stuck behind them.

## The plan

1. `.github/dependabot.yml`: ignore major updates of `typescript` and `@types/node` in the npm group; minor and patch still come
2. **Security bump #57** (`serialize-javascript` 7.1.2 to 7.1.4, used by the PWA build) targets `main`, which `release-source` refuses: the same bump goes into staging as a pnpm override in the root `package.json` (only that package changes in the lockfile), and #57 is closed
3. Dependabot reads its settings from `main`, so the pins apply after the next release; the npm PR (#101, then #106, still with TypeScript 7) is closed, and the first run after the release opens a clean one. After the merge, `@dependabot recreate` on #101 (or close it and wait for Monday's run): the same PR without those two

## Done when

- #101, recreated, bumps neither and passes `checks`

## Not in this task

- Moving to TypeScript 7: when `openapi-typescript` supports it
