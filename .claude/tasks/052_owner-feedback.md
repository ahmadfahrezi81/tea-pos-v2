# Task 052 — The owner's feedback round

**Status: in progress 2026-10-29, on `feat/backoffice-feedback`; changes added as the owner gives them.**

## The goal

The owner's test round on staging (RFC: [Backoffice v2 refinement](https://app.notion.com/p/40595a7154058188873dd594ee4b7875), Step 52): mostly UI fixes, each made as it is given, all in one PR.

## The changes

1. **The header, back to v1's on a tab's home:** the big title on the left, the avatar (Account) on the right, nothing else; a tab home's actions live in the page. A screen under a tab: back, then its title beside it on one line (text-2xl, semibold), the actions on the right. `packages/shell/MobileHeader.tsx`, so both apps get it
2. **⚙ leaves the header:** Pay settings is a row at the bottom of the Pay home (as All stores on Store); `settings` leaves `HeaderActions`' kinds, which keep add and edit for screens under a tab
3. **Header actions are words:** a brand-coloured button saying Add or Edit, not an icon; the ⋯ menu keeps its icons
4. **v1's shared components, before refining more** (owner: migrate the UI first, refine after). v1's phone screens use only its custom components; its shadcn set serves v1's desktop admin only, so nothing heavy needs a light rewrite. Into `packages/ui`, labels as props (ui has no translations):
    - `Skeleton` (and `SkeletonText`, `SkeletonValue`, `SkeletonChart`), on the `.skeleton` sweep already in globals.css
    - `form/SelectInput`, `form/ReadOnlyInput`
    - `ConfirmDialog` (v1 backoffice's ConfirmationPopup), `MonthStepper` (v1's MonthSelector, months as `YYYY-MM`)
    - `CopyButton` (v1 seller's CopyableField); the three copy buttons in Pay use it
    - `Avatar`, one for every person (round in lists, `square` in v1's cards); replaces eight hand-made ones in Store, Pay and UAC. `avatar()` moves to `@tea-pos/ui/avatarUrl` (`@tea-pos/shell/avatar` re-exports it)
    - Not ported: ErrorSheet (v2 translates every error code instead), FeedbackHistory and SummaryDetailsCard (screens with their own data, they come with the seller's More and analytics), the weather sheet (already in backoffice More; moves to the shell when seller's More needs it)
5. **Every loading placeholder is a `Skeleton`:** the plain white and grey boxes in Store, Pay, UAC and More, and `ListRowSkeleton`, sweep as v1's do; lists stagger by row
6. **Account and More stay v1's** (owner: screens that already existed keep their look):
    - Account: the profile card (square avatar, name, email), the rows Personal details, Language and App info (each its own page under `/account/`), then at the bottom the red Log Out (confirmed with `ConfirmDialog`) and the version pill. Sign out on every phone leaves the screen (its API stays)
    - Personal details: v1 seller's page, read only: email, user ID (copy), first and last name, phone, member since. `/me` gains `phone` and `since` for it; `formatLongDate` in `packages/format`
    - Language: v1 seller's list; every language shown, the ones the app does not offer greyed (backoffice: English only)
    - App info: the API status, versions and commits (`StatusScreen`)
    - Account closes with an X, not back: `close` on the route (`ShellRoute`), as v1's inline header
    - More: General with the app's rows and Patch Notes (v1's name for What's new); the Account row goes (the avatar opens it, as v1)

## Done when

- Typecheck, lint, build and bundle size pass
- The owner checks each change on staging
