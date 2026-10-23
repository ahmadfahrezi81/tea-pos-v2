# Task 014 — Frontend groundwork

**Status: done 2026-10-22, PR #15. CI green; the owner tested the Pages preview at 20× CPU on Slow 4G (fast; the splash fix came from that test) and installed the staging build on an iPhone (fast). Slow Android phones are checked at the pilot. First screen 123.7 KB gzip, budget 130 KB.**

## The goal

Both apps become real Vite and React apps on Pages: the shell, router, data layer, PWA and translations in place, a sign-in screen and a home screen. Every feature screen after this only adds a route. No Railway needed: deploys go to Pages only, against the API already running.
RFC: Build order Step 14; Stack (Framework through Translations); Performance budget; Code migration.

## The plan

1. **`packages/config`**: the shared `tsconfig` for apps (React, `jsx`), `vite.base.ts` (React with the React Compiler, Tailwind 4 via `@tailwindcss/vite`, `vite-plugin-pwa`), and the Tailwind theme (`globals.css` from the old seller app, Inter Latin subset only, preloaded)
2. **`packages/ui`, copied on demand:** only what the shell, login and home use now; every later screen brings the components it needs, reviewed as they arrive (an unused file costs the phone nothing, but it is code to maintain)
   - **One Radix style:** the combined `radix-ui` package, never the single `@radix-ui/react-*` ones
   - **One icon set:** `lucide-react`. The Fluent emoji stay, as plain SVG files in `packages/ui/emoji/` drawn by one `<Emoji name>` component (`<img>`, cached by the service worker, never in the JavaScript); `@iconify/react` and the hand-bundled `bundled-emoji.ts` go
   - `sonner.tsx` drops `next-themes` (the apps have no dark mode): fixed `theme="light"`
3. **`packages/utils`:** only `cn` for now; the rest of the old `utils` comes with the screens that need it or is replaced: `swr` (TanStack Query), `schemas` and `errors` (the contract and `httpx` codes), `server-config/*` and `roleUtils` (Go decides, Step 13), `translations` (`packages/i18n`), `realtime` (Step 26), the date and money helpers (`packages/format`)
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
8. **Bundle-size check**: `scripts/bundle-size.mjs` (no library): gzips the JavaScript the first screen loads (from Vite's manifest) and fails over the budget. The budget is set just above what this step measures (likely about 100 KB), so a regression shows at once; each feature step raises it on purpose, visible in the PR comment, up to the POS's 170 KB. Runs in `checks`; the size goes into the PR comment as its own section (`bundle-size`)
9. **CI:** `pages.yml` builds with `vite build` instead of copying `public/`; `checks` runs the Vitest tests and the bundle check
10. **`CLAUDE.md`:** the new packages, `pnpm dev` per app (`wrangler pages dev` runs Vite and the `/api` forwarder against the staging API; `EDGE_SECRET` through `infisical run`), the bundle budget

## Changed while building

- **No `packages/utils` at all:** `cn` was only used by `ActionButton` to join two class names, and it pulled in `tailwind-merge` (7 KB on the sign-in screen). Plain string joining now; `cn` comes back with the first component that really merges classes
- **The week and pay-period helpers stay out of `packages/format`:** they compute pay periods, which Go owns (principle 1); they move to Go with Steps 20 and 23
- **The router replaced three hand-written pieces of the old shell:** scroll memory per history entry (the old `useScrollRestoration`), back that survives a reload (`useCanGoBack`, replacing the push counter and its reload bug), and the route table (each route carries `staticData.shell`; no per-app `resolveRoute`). The Android back-button hold (a workaround for Next.js) is gone; check it on a slow phone in staging
- **Pull to refresh and the idle sheet** call TanStack Query themselves (`refetchQueries`, `invalidateQueries`), so apps pass no refresh function
- **`WhatsNew` is not copied yet:** it has nothing to show until Step 16b, so it comes then
- **Local dev uses Vite's proxy, not `wrangler pages dev`:** the same `/api` rewrite and `X-Edge-Secret` as the Pages forwarder, with less to install
- **One config file per app, `apps/<app>/app.config.ts`:** name, brand colour, sign-in logo and words, languages. Vite fills `index.html` and the manifest from it, and the brand colour is set before the first paint; the routes and `index.html` are now identical in both apps
- **Second sanity pass:** the update and idle sheet lives in the shell (it no longer pops up on the sign-in screen); the account button hides until an app passes `onAccount`; the saved cache is dropped when the API's shapes change (a hash of `api/openapi.yaml`), not on every deploy, so a phone keeps its data across most releases; the header colour is one constant for the status bar and the install splash
- **Review pass:** the service worker now registers on every screen, sign-in included (`AppUpdateProvider` at the app root), and right away: the plugin's default waits for the page's load event, which has already passed when the app draws, so it never registered. `@tea-pos/config` is a dev dependency of the shell (types only)
- **Bottom-up pass:** one `Locale` type (format takes it from i18n); the shell layout route moved into the shell (`ShellLayout`), so each app's route is one line; back and close buttons get labels for screen readers and are one piece of code, not three; the loading bar no longer waits on a request that was dropped before it answered; React 19's `<Context value>` style throughout
- **Splash and startup (owner found the blink, then a broken-looking handover):** the old app's `launch.html` had no counterpart. Now index.html carries a plain-HTML splash with its styles inline (`packages/ui/styles/boot.css`), on screen before any CSS file or JavaScript. React never touches it: it fades out once (`shell/splash.ts`), when the shell is ready or, for a screen without the shell (sign-in), on first draw. Handing it over to a React copy showed a blank frame and a re-drawn logo, so that was dropped. The bar animates with `transform`, so it keeps moving while the phone parses JavaScript
- **Owner's preview test (20× CPU, Slow 4G): fast, but the splash was squashed to the top on grey.** `contain: layout` on body (for the phone column) makes fixed elements fill body, and body was zero-height while empty. Body now has `min-height: 100svh`; checked with the splash alone, at phone width and on a laptop
- **First paint needs only the HTML:** the stylesheet is inlined into index.html (a `<link>` blocked the first paint, splash included, for a round trip on slow 4G) and the splash logo is inlined (about 3 KB) so it never paints late. index.html is 9.8 KB gzip and precached
- **No startup waterfall:** index.html preloads the first screen's route code, the offered languages and the font, so they download with the main JavaScript instead of after it runs. The bundle-size check counts exactly what index.html loads, so the first screen is defined once (`packages/config/vite.ts`)
- **The benchmark (RFC, Performance budgets):** 20× CPU slowdown on Slow 4G, first visit and reopen, on a production build. The owner tests previews, never the dev server
- **Phone width in every browser (owner's ask):** the app is a centred 480px column with a grey surround on a laptop or tablet; phones are narrower, so the installed app is unchanged. `contain: layout` on body keeps sheets and overlays inside the column. One variable, `--app-max-width` in globals.css
- **Copied code's comments condensed** to one or two lines each (owner's review)
- **Budget 130 KB**, not 100: React, the router and TanStack Query are about 110 KB of it; the shell, home screen, service worker helper and one language the rest

## Owner's part

Nothing to click. The code review before the PR, and after merging, the PWA checks on the staging addresses (install, open offline, the update sheet after the next deploy).

## Decided in review

- **Backoffice uses the mobile shell too,** like today
- **One component library for every app.** `packages/ui` and `packages/shell` are the shared base for seller, backoffice and any later app. Anything the two old apps do differently for the same job (two versions of a component, a pattern written twice) is listed below and brought to the owner, not silently picked
- **Home screen:** API status and version until `/me` (Step 13)

## Found while copying (to unify)

- Three icon systems (lucide, Iconify, a hand-bundled emoji file) become lucide plus emoji SVG files: `<Emoji name>` in `packages/ui`
- Radix imported two ways become one (when the first Radix component is copied)
- **Two `globals.css` that had drifted:** backoffice's lacked the card, popover, primary and other theme colours its own components use. Now one theme in `packages/ui/styles/globals.css`; each app sets only its brand colour (seller blue, backoffice orange)
- **Two sign-in forms** (seller with the Lemoni logo, backoffice without): one `SignInScreen` in the shell, each app passes its words and logo
- **The boot loader, maintenance and auth-error screens** were written out three times in each app's layout: one `BootScreen`
- **Backoffice had no translations** (hard-coded English, and the shell took a do-nothing `t`). Both apps now use `packages/i18n`; backoffice offers English only (`locales: ["en"]`, owner's call), and adding Indonesian later is one line
- **The update and idle sheets had English-only text** in the shared shell: now translated
- **Later:** seller's store picker and backoffice's store filter do the same job differently; decided when Step 18 brings them

## Done when

- `tea-pos-staging.lykostech.app` and `tea-office-staging.lykostech.app` open the new apps: login screen at `/login`, home at `/` showing staging API's `/health`
- Installed as a PWA, the app opens with the network off (shell and last data drawn) and shows the update sheet after a new deploy
- Switching the browser language to Indonesian loads only `id.json` (network tab)
- `pnpm lint`, `pnpm typecheck`, the Vitest tests and the bundle check pass in CI; the PR shows the bundle-size comment
- No `next` import anywhere (`grep -r "from \"next" apps packages` is empty)

## Follow-up, 2026-10-23: updates reach the sign-in screen

**Found by the owner:** backoffice's `/login` kept showing the old build ("sign-in comes in the next update") until a hard reload. The update sheet lives in `MobileShell`, and `/login` is outside the shell, so a waiting build was never offered there; in "ask first" mode a normal reload does not swap it in either. A signed-out user would stay on an old build until every tab closed.

**Fix:** `useApplyUpdateNow()` in `packages/shell/AppUpdate.tsx`, used by `SignInScreen`: outside the shell there is no cart to lose, so a waiting build is applied at once (one reload). At most once a minute, so a worker that fails to take over cannot loop. Inside the shell nothing changes: the sheet still asks.

**Checked locally** (`vite preview`, two builds): on `/login` with build A, build B deployed, one normal reload: the page reloads itself into B, then stays.

## Not in this task

Sign-in itself and the logout that clears the cache (Step 12), `/me`, tenants and permissions (Step 13), PostHog and `X-App-Version` (Step 16b), What's new content (Step 16b), real screens (Step 18 on), realtime (Step 26), Leaflet and recharts (their screens).
