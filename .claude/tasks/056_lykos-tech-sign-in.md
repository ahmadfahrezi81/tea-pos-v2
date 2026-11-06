# Task 056 — The apps say who runs them, and stay out of Google

**Status: approved 2026-11-04, in progress.**

## The goal

Step 4 of the [landing page RFC](https://app.notion.com/p/40e95a7154058110b203dfbde253a6dc): tie the apps to lykostech.app before asking Google to review the "Deceptive pages" flag. The sign-in screens say who is asking, the apps stay out of search results, and their names match the home page.

## The plan

1. **"by Lykos Tech" on the sign-in screen** (`packages/shell/screens/SignInScreen.tsx`, both apps): one small grey line under the Google button, "by Lykos Tech · Privacy · Terms", linking to `https://lykostech.app`, `/privacy` and `/terms`. Only there: Google never sees screens behind the sign-in (the owner chose not to add it to App info). New keys `signIn.by`, `signIn.privacy`, `signIn.terms` in `packages/i18n/en.json` and `id.json` (core: the sign-in screen is the first screen)
2. **Noindex on every app address** (`packages/config/vite.ts`, the `_headers` the build writes): add `/*  X-Robots-Tag: noindex`. Covers `tea-pos`, `tea-office`, both `-staging` addresses, `pages.dev` and previews. Not a `robots.txt` Disallow: Google must still be able to visit the sign-in pages, for the review and to see the noindex
3. **Names:** `apps/seller/app.config.ts` name and short name `Tea-POS`; `apps/backoffice/app.config.ts` name `Tea-Office`, description "Admin backoffice for Tea-POS"; `signIn.backofficeTitle` "Tea POS Office" to "Tea-Office" in both languages. Installed apps pick up the new name from the manifest on their next update

4. **The page head** (`apps/*/index.html`, `%APP_DESCRIPTION%` filled in `packages/config/vite.ts`): a `description` ("Tea-POS by Lykos Tech: orders and sales at the stand.", "Tea-Office by Lykos Tech: stores, staff and reports.", the same words as the home page's Apps menu; also the manifest's) and `<meta name="robots" content="noindex">` beside the header (added at the owner's ask)

## Owner's part

- After the merge, look at the sign-in screen on staging
- Then the RFC's step 5 (Google Cloud consent screen, Search Console review), which Claude writes out click by click

## Done when

- `curl -sI` on staging's two addresses shows `x-robots-tag: noindex`
- Both sign-in screens show "by Lykos Tech · Privacy · Terms", each link opening the right page on lykostech.app
- The manifest and the backoffice sign-in title say Tea-POS and Tea-Office
- `pnpm lint`, `pnpm typecheck`, `pnpm test` pass

## Not in this task

- The Google Cloud consent screen and the review request (owner, RFC step 5)
- Production: it reaches the real apps with the next release
