# Task 060 — Dependabot keeps TypeScript 5 and Node 22's types

**Status: approved 2026-11-06, in PR.**

## The goal

Dependabot's npm PR (#101) bumps TypeScript 5 to 7 and `@types/node` 22 to 26. CLAUDE.md keeps TypeScript on 5 (`openapi-typescript` needs its JavaScript API) and Node on 22 (`.nvmrc`), so `checks` fails (`typescript-eslint does not support TS 7.0`) and the other 12 bumps are stuck behind them.

## The plan

1. `.github/dependabot.yml`: ignore major updates of `typescript` and `@types/node` in the npm group; minor and patch still come
2. After the merge, `@dependabot recreate` on #101 (or close it and wait for Monday's run): the same PR without those two

## Done when

- #101, recreated, bumps neither and passes `checks`

## Not in this task

- Moving to TypeScript 7: when `openapi-typescript` supports it
