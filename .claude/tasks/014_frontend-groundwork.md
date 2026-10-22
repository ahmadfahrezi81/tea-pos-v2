# Task 014 — Frontend groundwork

**Status: planned 2026-10-22, waiting on the owner's review.**

## The goal

Both apps become real Vite and React apps on Pages: the shell, router, data layer, PWA and translations in place, a sign-in screen and a home screen. Every feature screen after this only adds a route. No Railway needed: deploys go to Pages only, against the API already running.
RFC: Build order Step 14; Stack (Framework through Translations); Performance budget; Code migration.

## The plan

1. **`packages/config`**: the shared `tsconfig` for apps (React, `jsx`), `vite.base.ts` (React with the React Compiler, Tailwind 4 via `@tailwindcss/vite`, `vite-plugin-pwa`), and the Tailwind theme (`globals.css` from the old seller app, Inter Latin subset only, preloaded)
2. **`packages/ui`** copied from `../tea-pos/packages/ui`:
   - `components/*` and `custom/*`, except what belongs to later steps: `FeedbackHistory`, `WeatherDrawer` (need features and services), `chart` (recharts, comes with analytics)
   - `sonner.tsx` drops `next-themes` (the apps have no dark mode): fixed `theme="light"`
   - `mapbox-gl`, `@tea-pos/features` and `react-day-picker`'s unused parts leave its dependencies; `utils` imports point at the new `packages/utils`
3. **`packages/utils`**, only what is still needed: `cn`, `uuid`, `banks`, `navigation` (without Next.js). Gone: `swr` (TanStack Query), `schemas` and `errors` (the contract and `httpx` codes), `server-config/*` and `roleUtils` (Go decides, Step 13), `translations` (already `packages/i18n`), `realtime` (Step 26), `formatCurrency`/`formatDate`/`formatTimeAgo`/`time`/`week` (into `packages/format`), `weatherCode` (comes with the weather screen)
4. **`packages/format`**: one function per display style, `Intl` only (no date-fns): `formatDate`, `formatTime`, `formatDateTime`, `formatRelative`, `formatMoney`, all taking the locale; the week helpers from `week.ts`. Unit tests with Vitest, the first frontend tests in the repo
5. **`packages/shell`** copied, Next.js swapped for TanStack Router:
   - `usePathname`/`useRouter` become `useLocation`/`useNavigate`; `next/image` becomes `<img>`
   - `useAppUpdate` (polled `/api/version`) is replaced by `vite-plugin-pwa`'s `useRegisterSW`: the service worker finds the new version, the existing update sheet shows it
   - `navProgress` hooks into the router's pending state instead of its own click tracking; `InactivityRefreshPopup` calls `router.invalidate()`
   - `WhatsNew` stays but shows nothing until Step 16b (release notes)
6. **`packages/api-client`** gets the query layer:
   - one `QueryClient` with the `staleTime` tiers (`HOT`, `WARM`, `COLD`, `STATIC`, mapped from the old SWR tiers)
   - the cache saved to IndexedDB with `idb-keyval` and `@tanstack/query-async-storage-persister`, **one key per user and tenant** (`tq:<userId>:<tenantId>`), a `clearCache()` for logout. Until Step 12 there is no user, so the key is `tq:anon`
7. **`apps/seller` and `apps/backoffice`**, the same shape (replacing the placeholder `public/index.html`):
   - `vite.config.ts` from `packages/config`, `src/main.tsx`, `src/routes/` (TanStack Router file routes, code split per screen)
   - routes: `/login` (the sign-in screen, "Continue with Google" button that does nothing yet; Step 12 wires it) and `/` (home: the API's `/health` through `/api`, version and commit shown, inside the shell)
   - `$tenantSlug` comes with `/me` in Step 13, not now
   - only the active language loaded (`loadMessages`, already in `packages/i18n`), chosen from the browser until `/me` gives the user's
   - PWA: manifest and icons copied from the old apps, the whole app precached except lazy chunks; `functions/api` stays as is
   - `.env` none: the apps hold no secrets; the API is always `/api`
8. **Bundle-size check**: `scripts/bundle-size.mjs` (no library): gzips the JavaScript the first screen loads (from Vite's manifest) and fails over the budget, **170 KB per app** (the POS budget; it should sit far under today). Runs in `checks`; the size goes into the PR comment as its own section (`bundle-size`)
9. **CI:** `pages.yml` builds with `vite build` instead of copying `public/`; `checks` runs the Vitest tests and the bundle check
10. **`CLAUDE.md`:** the new packages, `pnpm dev` per app (Vite on the staging API through the same forwarder: `wrangler pages dev` proxies `/api`), the bundle budget

## Owner's part

Nothing to click. Review the copied `ui`/`shell` diff if you want: it is mostly the old code with imports changed.

## Open questions

- **Backoffice on the mobile shell too?** Today both apps use `MobileShell` (`MobileLayoutClient`); I keep that, and `components/sidebar` stays in `ui` unused. Strike out if backoffice should look different
- **The home screen content:** I show the API status and version only (a real home needs `/me`). Fine?

## Done when

- `tea-pos-staging.lykostech.app` and `tea-office-staging.lykostech.app` open the new apps: login screen at `/login`, home at `/` showing staging API's `/health`
- Installed as a PWA, the app opens with the network off (shell and last data drawn) and shows the update sheet after a new deploy
- Switching the browser language to Indonesian loads only `id.json` (network tab)
- `pnpm lint`, `pnpm typecheck`, the Vitest tests and the bundle check pass in CI; the PR shows the bundle-size comment
- No `next` import anywhere (`grep -r "from \"next" apps packages` is empty)

## Not in this task

Sign-in itself and the logout that clears the cache (Step 12), `/me`, tenants and permissions (Step 13), PostHog and `X-App-Version` (Step 16b), What's new content (Step 16b), real screens (Step 18 on), realtime (Step 26), Leaflet and recharts (their screens).
