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
    - `Avatar`, one for every person (round in lists, `square` in v1's cards); replaces eight hand-made ones in Store, Pay and UAC. `avatar()` moves to `@tea-pos/ui/avatar` (`@tea-pos/shell/avatar` re-exports it)
    - Not ported: ErrorSheet (v2 translates every error code instead), FeedbackHistory and SummaryDetailsCard (screens with their own data, they come with the seller's More and analytics), the weather sheet (already in backoffice More; moves to the shell when seller's More needs it)

## Done when

- Typecheck, lint, build and bundle size pass
- The owner checks each change on staging
