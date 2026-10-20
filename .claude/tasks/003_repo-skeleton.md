# Task 003 — The repo skeleton

**Status: done 2026-10-20, reviewed by the owner. `pnpm lint`, `typecheck` and `format:check` pass; a wrong key and a key missing from `id.json` both fail the typecheck; 68 migrations identical to the old repo.**

## The goal

The empty monorepo every later step builds in: pnpm and Turbo, shared TypeScript and lint settings, translations as JSON, and the Supabase migrations now owned here.
RFC: Build order Step 3, Repo and code.

## The plan

1. **Root files**
   - `package.json`: `pnpm@10`, Node 22 (`engines`, `.nvmrc`), scripts `build`, `lint`, `typecheck`, `format` through Turbo
   - `pnpm-workspace.yaml`: `apps/*`, `packages/*` (`api/` joins in Step 4)
   - `turbo.json`: `build`, `lint`, `typecheck`, `dev`
   - `tsconfig.base.json`: strict, `moduleResolution: bundler`, `target: ES2022`, TypeScript 5 (not 7: `openapi-typescript` needs 5's JavaScript API)
   - `eslint.config.mjs`: ESLint 10 flat config (9 is deprecated) with typescript-eslint (React rules join with the apps in Step 14)
   - `.prettierrc`: 4 spaces, as the old code
2. **`packages/i18n`**
   - `en.json`, `id.json`: converted once from the old `packages/utils/translations/{en,id}.ts` by a throwaway script, not kept
   - `index.ts`: `loadMessages(locale)` downloads one language; `t(messages, key)` with the key type taken from `en.json`, so a wrong key fails the typecheck. Both languages are typed as the same shape, so a key missing from `id.json` fails too (no English fallback needed)
   - Loading only the active language is the app's job (Step 14)
3. **`supabase/`**
   - `supabase/migrations/`: copied from the old repo, all 68 files, unchanged
   - `supabase/config.toml` from `supabase init` (the old repo has none; Step 8 needs it for a local Supabase). Postgres 17, as production (17.6)
   - From now on migrations are created only here
4. **`CLAUDE.md`**: a Quick start section with the commands above

## Decided: UI packages move to Step 14

Approved by the owner. The RFC said `packages/ui`, `shell` and `utils` are copied in this step. I'd move that to **Step 14** instead, copying only what the apps use:
- `shell` and parts of `ui` import Next.js (`next/navigation`, `next-themes`), so copied now they would not build
- much of `utils` is replaced: dates and money by `packages/format`, `swr.ts` and `server-config/` disappear, the realtime adapter is rewritten
- "a package exists only when two apps share it": Step 14 is when the two apps exist

## Owner's part

- Review this file and the suggestion
- **Stop creating migrations in the old repo** from the moment this PR merges

## Done when

- `pnpm install`, `pnpm lint`, `pnpm typecheck` pass on a clean clone
- An unknown key, or a key missing from `id.json`, fails the typecheck
- `supabase/migrations/` matches the old repo file for file

## Not in this task

The Go module (Step 4), CI (Step 5), the Vite apps and the copied UI packages (Step 14), `packages/format` (with the apps, Step 14).
