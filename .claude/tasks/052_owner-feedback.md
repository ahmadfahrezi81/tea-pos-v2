# Task 052 — The owner's feedback round

**Status: rounds 1 and 2 released (2026.10.6, 2026.10.7); rounds 3 and 4 next.**

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
24. **Pay in the house style:** the period's people as v1's lists (`SettingsGroup` headings, `ListRow`s with square avatars, a badge for Paid, Skipped, Ready or what is waiting, the amount and the orange chevron); no grey text left in Pay's screens (labels, notes, section headings turn black, headings bold as the panels'); every avatar in the app is square, as v1's
25. **Bigger period arrows:** ‹ › are 44 px grey squares with a 26 px bold chevron (`STEP_ARROW`, `stepIcon` beside `MonthStepper`, which uses them too)
26. **Store's home, real stores only:** demo and shut-down stores leave the list (they stay reachable through All stores' views and UAC); the "0 of 10 open" line goes; each card: name and an Open or Closed badge, the seller (or when it closed) in black, a divider, today's sales and cups, the orange chevron; All stores is a menu row; nothing to show is the empty state. `OpenBadge` is a `Badge` (Open, Closed, Demo, Shut down)
27. **A store's page in panels:** Right now (the Open or Closed badge in the heading; a grey tile with the seller, their photo and since when, or when it closed), Today (the sales large, Cups and Orders as two grey tiles, cups by hour in a grey tile or a no-sales line), then the Analytics and Orders rows. `Panel` gains `beside` for the heading's right. Store's words live in the core files' `store` section; Shut down and No stores yet moved there
28. **Store's home, built for the day:** a Today panel on top over the stores shown (sales, Cups and Orders tiles, cups by hour from `sales/hours` with exactly those stores), then search and a filter (type: Real stores by default, Demo, Shut down, All; an Open only switch), then the stores. Each card shows who sold there today with their cups, as the analytics card does (`Sellers`, moved to `store/Sellers.tsx`), so a store with two sellers shows both. API: `stores/live` gains `sellers` per store (`StoresLiveSellers`; the seller on shift is in it before their first order)
29. **The store in the title, not on every card:** a store's screens (Analytics, its charts, a day, its activity and sessions, Orders and its chart) title `Laladon STG · Analytics` (`All stores · …` together) through `StoreTitle`; the day cards and orders show a store's name only over several stores (they read the address now, not the old picker's store)
30. **Review, three passes** (the owner's ask before staging):
    - Bugs: UAC's and Store's search and filters live in the address (`useSearchParam`, `useSearchText`, `useSetSearch` in `shell/session/searchParam.ts`), so back and a shared link keep them; a day's title names its own store even from All stores; Log Out asks with the bottom sheet like every other action (`ConfirmDialog` goes); the store card's fallback seller has its own key; `useDay` no longer asks with an empty id
    - Repetition: one `TodayPanel`; every tag is a `Badge`; one `SectionLabel` heading (Settings, Panel and Field use it); one `useSlug` (`shell/session/tenant`); lists inside a `Sheet` line up by themselves (`.sheet`), no more `-mx-4`; calendar days, `addDays` and `localHour` in `packages/format` (with tests), so no screen builds its own Intl formatter or WIB arithmetic
    - Structure: `packages/shell` in `screens/`, `frame/`, `session/`, `lib/`; `packages/ui` in `layout/`, `feedback/`, `controls/`, `lib/`; both export each file by name, so no app import changed. `@tea-pos/shell/avatar` goes (use `@tea-pos/ui/avatarUrl`)
    - Left: the unused `GET /feedbacks` and `POST /auth/logout-everywhere` (a backend PR); `ReadOnlyInput`, `SelectInput` and the Skeleton variants wait for the seller's screens
31. **`pnpm backoffice` runs everything local on staging's database:** local Go and local Vite together (`scripts/dev.sh`), secrets from Infisical's `staging`
32. **`pnpm backoffice:prod`, the real data, read only:** the same on Infisical's `prod`; Vite refuses every write before the proxy (`READ_ONLY`), except sign-in, sign-out and the app's events; PostHog keys blanked

## Round 2: the owner's list from production (2026-10-30)

Listed first, built after the walkthrough.

1. **Backoffice sign-in looks too light:** the heading and description are boring, and there is no icon
2. **New backoffice icon (the owner makes it):** the current one is lazy; remind the owner to update all icons, seller's excepted, and double check them
3. **Keep the new icon light:** compress it, so it wastes no kilobytes
4. **Personal details editable in Account (backoffice):** at least the name, as the owner recalls v1 allows; check v1
5. **The owner is wrong on production and cannot be changed:** the backfill picked each tenant's earliest admin. Let the owner be changed. Not decided: the owner may look again at how owner is designed, or drop the idea; for now it may just be changed by SQL. Remind the owner to look at the design
6. **Bottom sheets drag to close:** pulling the handle down does nothing today. Our own, light, no library (`Drawer`), so every sheet gets it
7. **Confirmation sheet's bottom padding too thick on phones:** cut it in half. Today `Sheet`'s `pb-5` (20 px) plus `Drawer`'s safe area; to `pb-2.5` (10 px), the safe area stays
8. **Every core has How it works:** Store, Pay and UAC each get the section; UAC's `/uac/help` exists, so Store and Pay follow it
9. **Store home needs a redesign:** the top's Today with its icon becomes a date range selector: our own (shadcn has one, no library), with presets (last week, last month) and a custom range. Concern: it means backend changes and may be heavy, so design how ranges are served first. Agreed look: Vercel's dashboard selector made ours and mobile friendly, in a bottom sheet: preset rows, then a Custom range calendar with Apply; no typed times, whole days in the store's time zone
10. **Store home's purpose (to discuss with the owner):** see how the whole business is doing today at a glance, close to the analytics page. The filter (Demo, Shut down, Open only) goes, the All stores row goes, and the search and filter approach is rethought. Decided: shut-down and demo stores leave the home and its totals; demo stores stay as data, for testing (check staging still has real stores to show)
11. **A store's page has no clear purpose (to discuss):** it repeats the home's day, and Analytics and Orders are one level deeper with their own month selector. Proposal: one page with the home's range and no tabs: the summary, then the latest orders coming in (a snippet; See all opens the orders page), then a row to the day-by-day page (today's Analytics), which is only for scrolling back through days. One range only: day by day follows the selected range (kept in the address) and has no month selector of its own; on a single day the row opens that day's detail
12. **Pay's period header:** the amount owed goes. The pay date and days left go too, or get their own properly padded section; compare with v1
13. **Pay's people, cleaner and with more up front:** rethink the Ready and not ready grouping, and show the detail on the row before tapping, as v1's payroll page does; compare with v1
14. **Pay Settings is too complicated (to discuss):** break down what handles what. Should Staff Payroll Info live in UAC or a person's page? Pay Schedule leaves it, for a deeper, dangerous settings area under More
    - Decided: anything about one person (Staff Payroll Info, Staff Commissions) moves to their page, combined in a Pay panel; guests may see it (they are family), only admins edit. Commission and Claim Types stay in Pay Settings, formatted nicely; Pay itself stays about paying
    - Decided: the UAC tab becomes People
15. **Inactive does not lock anyone out of v1 (bug):** v1 seller's proxy sends anyone whose `users.status` is not `active` to `/unauthorized?reason=<status>`, but v2 only sets `user_tenant_assignments.status`. The RFC's "v1 never checks a status" is wrong. Fix: v2 also writes `users.status` while v1 runs, in the same transaction (it is one per person, not per tenant). v1 backoffice checks only the role, so it needs `users.role` (already synced) to keep them out. Also add a separate Suspended status if the owner wants one (v1 has both, with their own messages). Correct the RFC
16. **The rule for every core: detail outside, more detail inside.** A list shows the useful numbers before any tap, and tapping gives the breakdown. Pay's people show the breakdown (commission, cups and so on) as v1's list does; Store likewise, then Orders for more

**Pay, as built:** the period header is only its dates and arrows; the pay date has its own card; each person is v1's card (orders, cups, commission, claims, total, what is next), to review first, then ready, then Done. A person's page in People gains a Pay panel (commission type, bank), and changing the type opens `/uac/<id>/commission`; Staff Payroll Info and Staff Commissions leave Pay Settings, which keeps the two types with a count. Pay Schedule moves to More → Advanced (`/advanced`). How it works for Pay at `/pay/help`, on the shared `HelpTopics`.

**Store, as built:** one range in the address (`?from=&to=`, today when absent) on every Store screen, from `RangeBar` and `DateRangeSheet` (`packages/ui`: presets, then a calendar; no library). `stores/live` takes an optional range; `orders` and `days` take `from` and `to`, replacing `date` and `month`. The home: range, totals and chart (by hour on one day, by day otherwise) over real stores, a card per store, then Orders, Day by day and How it works; the filter, search and All Stores row go. A store: who is on (today), the same numbers, the latest 5 orders with See all, Day by day (on one day, that day's detail). `/store/all` redirects to the home. The orders chart page keeps its own day.

**Personal details, as built:** Edit on the screen (shown to anyone: it is their own) changes first and last name and phone, as v1's API allows; `PATCH /me` takes `fullName` and `phone` beside `language`. In the shared shell, so both apps have it. v1's API also lets people edit their bank; left out, since bank details now show on a person's page in People.

The owner's walkthrough ended here; build these now. The owner does 2, 3 and 5's SQL.

## Round 3: the owner's list, after 2026.10.7

1. **The update pop-up takes too long:** in v1 (Vercel) a deploy shows almost at once, on the next navigation or as the bottom sheet. Find out why ours is slow (CDN, service worker, how often it checks). Not caused by PostHog
2. **PostHog runs every 60 seconds, too much:** production downloads the flag rules every 60 seconds (`POSTHOG_FLAGS_POLL_SECONDS` in `.railway/railway.ts`; staging 300). Decided: 300 on production too; a flag change then takes up to 5 minutes
3. **Confirmation sheet's bottom padding still looks thick on the PWA:** the cut in round 2 does not show; check the footer's extra PWA gap too
4. **Store home's cups and chart look like one store (bug):** with two real stores they should show the total; check the totals and cups by hour over all real stores
5. **Check the Store endpoints are efficient:** no heavy compute at once, each screen fetched well, well-designed endpoints
6. **Nested bottom sheets, back in the title:** as YouTube and our own header: a back arrow beside the sheet's title, top left, no extra row. `Sheet` gains `onBack`; the date range and People filter use it, and any other nested sheet
7. **Store cards show more, as the analytics card, condensed:** sales, orders, cups, and cash at a glance, without much height. Proposal: a 3-column grid of Sales, Orders, Cups, a one-line Cash row (counted and the difference from expected), then the seller row; the repeated cups line goes. Cash comes from the day summaries, so `stores/live` or the screen needs it (see 5)
8. **Pay cards shorter, one row:** only Cups, Commission, Claims and Total; Orders goes. Three equal coloured tiles in one row: Commission, Claims, Total; cups go under the name with the approved count. Item 7's Store card goes ahead as proposed
9. **Pay date back inside the period card:** one card: the arrows and dates, then under them a small grey tile with its own padding (as the seller row: `bg-slate-100`, rounded), holding the next payout and the days left. The separate card goes
10. **Swipe the Pay period card left and right to change period:** only on that card, as a sheet's handle is only for dragging; right is the period before, left the next, none past the current one. Arrows stay
11. **Lists stand apart from menu rows:** on core homes it is unclear where the list ends and the menu rows begin. A list (Pay's people, Store's stores) sits inside a thin-padded container with its heading and count; a divider separates it from the menu rows. One shared component for Pay and Store
12. **Headings outside the box:** as More's GENERAL label, a section's heading sits above its box, no big icon inside. Payouts (11) above the container; `Panel`'s heading moves out, for People's Apps, Stores and Pay and any other panel
13. **A person's page condensed, as the payslip's details:** label on the left, value on the right, one line each, tight rows, for Status, Email, Phone, Member Since, and Apps, Stores and Pay. Headings outside, no icons (12), also on Store's Today panel. The duplicate name (title and profile card) can go down to one line in the card
14. **One image preview everywhere:** today the payslip's receipt has no close button and a day's photo has its X on the image. One `ImagePreview` in `packages/ui`: full screen on black, a top bar with the title on the left and the X on the right (as Slack), the image fitted under it; a tap outside the image or back closes it. The receipt, the day's photos and any other preview use it

**Round 3, investigated:** the chart read only the first store: `storeId` was sent repeated while Huma expected commas (`query:"storeId,explode"` now, with a test). The update sheet was slow because it waited for the new worker to finish downloading; v1 asks `/api/version` first. Now `version.json` (static, uncached, `versionFile` in `packages/config/vite.ts`) is the question, on open, foreground and a tap, at most once a minute; a different answer shows the sheet at once and starts the download; Update waits up to 10 s, then drops the old worker and reloads from the network; a declined build is not asked again. Docs: `/api/docs` on a laptop only.

## Round 4 (2026-10-31)

1. **The divider line between lists and menu rows goes:** the container and spacing separate them
2. **Store's date selector is the heading:** no Today label above the numbers
3. **The save footer's bottom padding, at last:** every earlier cut was on bottom sheets. Screens under a tab halve the shell footer's home bar gap; the bar is `px-4 py-3`, on the form footer, the route's CTA and the payslip's Pay bar. The tab bar keeps its full gap
4. **The payout row copies the seller bar:** icon in its own square, bold text, an orange pill for the days left
5. **Pay card:** name and pills, Total above its amount at the top right, tiles for Cups, Commission and Claims (`Tile` in `packages/ui`)
6. **One avatar shape:** the header's proportion, about 29%, at every size; no round or square option
7. **Store card, by what the business measures:** a status pill under the name always (open, closed with its time, not closed in red, days closed). One day: Opening, + Sales, − Expenses, the total top right (Expected while open), a red bar when the cash is off. Several days: Sales top right; Cups, Expenses, Cash off. `stores/live` gains opening, days, notClosed, closedAt and expenses in the same join
8. **Updates are downloads (bug, on staging: the sheet kept coming back and Reload stayed on the old build):** a reload alone is answered by the old worker. Now the new worker takes over first. A fresh open shows a full download page with progress, with Try again and Continue after 60 s (no way out on a 426). In use it downloads behind a toast at the top that cannot be closed, then a sheet asks to reload; Later lasts until the next open. Progress counts the new worker's files as they are saved
9. **A way out by hand:** Update app in More, with the version: no worker and no saved files, then a reload from the network (`forceUpdate`). Refused with no signal. It only helps builds that have it
10. **Update edge cases:** attempts per build survive the reload: a second try clears the worker and its files, and after two it stops asking until the next build, so no phone needs a reinstall or loops. A screen's code gone after a deploy reloads the page once. App info says API commit and App
11. **The toast stayed at 100% on iPhone, no sheet (bug):** files were saved but the phone never reported a waiting worker. The registration is asked afresh each time; all files saved for 5 s counts as done; with no worker to hand over to, Reload clears the old one and reloads from the network
12. **Update app in More uses the same flow:** no confirm sheet. Already latest: a toast. New version: the top toast. No signal: a toast, nothing changes.
13. **No update sheet:** in use, the finished toast counts down 5 seconds and reloads by itself, the owner's call, knowing it drops an unsaved cart or form. The idle sheet stays
14. **No failure buttons:** a download past 60 s closes the page or toast and the app stays usable; the next open tries again; a second failure clears and reloads by itself, only if the new build can be fetched. After a 426 the page stays until it gets through

## Round 5 (2026-10-31), fixed live

1. **Less space under the header:** the shell's content has 12px top padding, was 16px, and the header 8px bottom padding, was 12px, on every screen
2. **Card lists have no padding, only an 8px gap:** `ListSection`, on Store and Pay
3. **Panel padding 12px, was 16px:** `Panel`, on every screen that uses it
4. **Loading bar runs between the page's padding (trying it):** 16px in from each side, with rounded ends.

### To build, all at once in one PR

1. **Store's top card sums up the store cards below:** drop Orders; Cups, Expenses and Expected or Total (Cash off over several days), in the store cards' `Tile`
2. **Store's date range reads as the page's heading and as the place to choose:** no white bar: a large title, the dates under it, a chevron and a calendar button
3. **Pay: a recap card between the week switcher and Payouts:** the total to send, with total cups, commission and claims
4. **A person's edit is one place, and shorter:** status, apps and stores, plus their commission and claims set there, not by going out to Pay; no Edit button or edit screen: the person's page lists it all, each row opens a short sheet (`Segmented` for levels, tighter store rows)
5. **An admin can rename a person and change their phone** (not email). No remove: inactive is the remove
5b. **Inactive means None in every app (bug):** today an inactive person stays Member in Seller. Levels and stores are cleared on turning off, and `levels_set` keeps None from falling back to `users.role`, also for an active person set to None everywhere
5c. **People hides inactive people by default:** the Show inactive people filter starts off
8. **App info moves from Account to More:** a section of its own, with Update app
6. **More of a person shows from the outside:** at a glance in the People list, without opening them
7. **No menu behind Edit:** the rows are the menu; the owner may come back to this

## Round 6 (2026-10-31)

Fixed live: the loading bar is 3px and sits inside the header, with 8px above and 8px below. The content's top padding is 8px. A short bar loops left to right while loading; when the page is there it waits to reach the centre, stops, and grows from there to full width, blinks and goes.

### To build, all at once in one PR

1. **A person's settings are pages, not sheets:** each row on the person's page opens its own page (`/uac/<person>/apps`, and so on), with its save in the footer and a confirm sheet before it writes, as every write in the apps
2. **The update lives in the header, not a floating toast:** on a tab's root it takes the title's place (the account icon stays), in a black box with progress and a small animation, an arrow dropping into a tray, a tick when done; on inner pages it does not show, the download carries on behind, and the countdown and reload wait until back on a root
3. **Store's date range is a white strip:** two lines, the title, then the dates and the week (Week 44, for up to two weeks' range) under it, a chevron beside the title, an orange calendar icon on a soft orange tile on the right
4. **Store's top card, again :** a small Sales label over a smaller figure, the size of a store's name; top right empty. Over several days three tiles, one figure each: Cups, Avg cups a day, Tea waste. No best day, no average cost. One day: Cups, Expected cash, Tea waste
5. **Store's chart takes the full width :** no padding on the left, right or bottom of its tile, so it runs edge to edge, and a slightly lower height
6. **A store's Latest orders:** the last 3, not 5, in a grey group as the lists before, so it takes less height
7. **Pay's recap is in the week card:** one tight grey row, no icons, two columns of a small label over its figure: Total payout (what is left to send, or what was paid once all is paid) over the amount, the pay date over its state as a badge (days left, ready to pay, waiting, Paid); no separate card, no tiles
8. **Advanced in More is for admins:** a guest in the office does not see the row
9. **People list:** the avatar at the top of the row, not its middle; ordered owner, admins, office guests, sellers, no access, inactive, then by name

10. **The refusal of `pnpm backoffice:prod` says so** (`errors.read_only`), not Something went wrong

The owner swapped the tenant's owner by SQL on production, and consolidates duplicate accounts by turning them inactive.

## Done when

- Typecheck, lint, build and bundle size pass
- The owner checks each change on staging
