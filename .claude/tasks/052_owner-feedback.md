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
7. **Shared animations, no library** (v1 used vaul, Radix Dialog and two animation packages): `packages/ui/styles/motion.css` gives Tailwind utilities, transform and opacity only, off under reduced motion: `fade-in/out`, `sheet-in/out` (v1's drawer ease), `pop-in/out` (dialogs), `rise-in/out` (toasts), `drop-in` (menus). `usePresence` (`ui/motion.ts`) keeps a closing element until its exit plays. `Drawer` and `Dialog` (`ui/Drawer.tsx`) are the one bottom panel and centred card; Sheet, ConfirmDialog, the form footer's and refresh sheets, Weather, the payslip's decision sheet and receipt, and the day's photo viewer use them. Toasts rise in, the ⋯ menu drops in. `@tea-pos/ui` exports `./*`, so a new component needs no export line
9. **Bebas Neue goes** (owner: a font for one title is not worth it): the weather sheet's title is Inter, the package leaves the backoffice
10. **Location Feedback goes, for now** (owner: not a priority, maybe later): its screen, route, row, words and Leaflet leave the backoffice; More keeps Weather and Patch Notes. Go's `GET /feedbacks` stays until decided
11. **UAC's home as v1's Staff Payroll Info list:** a search box, then everyone in a `ListCard` of `ListRow`s with square avatars (no "People (n)" heading); requests waiting stay on top under their heading. `SearchBox` moves to `packages/ui` (Pay's staff lists use it too)
12. **Search box fuller:** taller (py-3.5), a 20 px magnifier, the clear X a 24 px grey circle
13. **22 px is the content icon size:** `ICON` in `packages/ui/icon.ts`; menu rows (`rowIcon`), chevrons, field icons, list and card icons use it. The header, the tabs and small icons inside a line of text keep their own sizes
14. **A person in UAC is read first, edited behind Edit:** `/uac/<userId>` shows the profile card (square avatar, name, Active or Inactive and Owner badges), the details (email, phone, member since: `phone` and `since` added to `UacPerson`), the apps with their levels, and the stores they have; Edit (hidden from guests and on the owner) opens `/uac/<userId>/edit`, the form as before. `DetailList` and `DetailRow` move to `packages/ui`; Personal details uses them too
15. **UAC's list at a glance:** A to Z; under each name a square-cornered grey tag per app with its level (`Seller · Member`, `Office · Admin`; no colours), or one tag for Owner, Inactive or No access; no grey line. A filter beside the search, nested per app: Seller (any, member, none) and Office (any, admin, guest, none) each open their levels, a switch shows or hides inactive people, Reset clears it (`uac/PeopleFilter.tsx`). How access works at the bottom opens `/uac/help`: one account with a level per app, each app's levels, the owner, stores, inactive, requests. New in `packages/ui`: `Badge`, `FilterButton`, `ChoiceList` (Language uses it too)
16. **Editing a person, clearer:** Status (an Active switch, the note when off), then Seller and Office each as v1's pick-one list with a hint per level, then Stores (a count, roomy rows, the tick on the right). Save sits in the footer always, greyed until something changes, and asks first. Every backoffice write now asks first: Reject and Block on a request gain the confirm sheet (they were the only ones without)
17. **Bottom gap once, never twice:** the phone's home bar gap comes from one place each: the shell's footer (`pb-[env(safe-area-inset-bottom)]`) for anything in the footer, `Drawer` for every sheet. So `FormFooter`'s bar is `p-4` (was `pb-8` on top of the footer's gap), sheets drop their `pb-8`/`pb-10`, the payslip's Pay bar moves from its own fixed bar into the footer slot (and its page's `pb-32` goes), and pages lose the extra `pb-8`/`pb-24` the scroll area's padding already gives
18. **Stores split by type, real ones first:** Real stores, Demo stores (`fake`), Shut down stores (`inactive`), each its own group with a count (`2/5` while editing), on the person's page, their edit and a request (`storeGroups` in `uac/uac.ts`)
19. **Apps and Stores each in their own block:** `Panel` (`packages/ui`), a white card with an icon and a bold heading whose inner cards turn grey (`bg-slate-100`, white dividers), as v1 seller's analytics cards; `ListCard` and `ChoiceList` do it with `in-[.panel]:`, holds the groups about one thing; `PanelLabel` heads a card inside it. A person's page and its edit (and a request) show an Apps panel (Seller, Office) and a Stores panel (by type)
20. **One big switch:** the shared `Switch` is v1 seller's store-sheet switch (h-8 w-14, a wide knob), with an optional `icon` in the knob; the store sheet's eye switch uses it, and every other switch (UAC, the filter, claim and commission types) gets the bigger size
21. **No grey text inside a panel:** list subtitles, choice hints and panel labels turn black there (`in-[.panel]:`); a person's page drops its grey (owner line, owner note, inactive, None, no stores)
22. **Empty states:** `EmptyState` (`packages/ui`): a white card, the dot grid, one shared emoji, the ghost from Iconify's Fluent Emoji set (`@iconify-json/fluent-emoji`, as v1's and the other six) (the only picture any empty state uses), a bold title and a line under it. Pay's period, a missing payslip, claim and commission types, What's new, UAC (nobody, or nobody matching), a store's orders and month, a day's activity and sessions, Weather, and no tenant use it
23. **Pay:** Pay settings is a menu row (`SettingsGroup`, as More); `1 day left`, not `1 day(s) left`

## Done when

- Typecheck, lint, build and bundle size pass
- The owner checks each change on staging
