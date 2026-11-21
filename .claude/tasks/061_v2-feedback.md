# Task 061 — Feedback: Seller v2 and Backoffice v2

**Status: done 2026-11-21. Items 1-51 built and released (2026.11.7 to 2026.11.14). Left, each a Notion card in Planning: item 26's store delete ("Store soft delete (feedback item 26)") and item 27 with item 33's order edit and delete ("Correct a day (feedback item 27)"); item 39.3 (a lighter skeleton) later.**

**Rounds:** 1-4 (PRs #115, #117, #118), released in 2026.11.7 and 2026.11.8. Round 5 (#120): items 36, 39.3, 41, 42. Round 6 (#121): cancelled requests never toast, item 41 redone as a banner, items 43, 44. Round 7 (#122): item 15. Released together with #123 and #125 as 2026.11.9 (2026-11-07). On hold (2026-11-07, the owner builds chat first): item 27, and item 26's delete (item 49 did the rest without a migration).

## The goal

The owner's feedback on both v2 apps, on a clean slate after [RFC: Seller v2](https://app.notion.com/p/40a95a715405810b9d37db50d22c76b3) and [RFC: Backoffice v2 refinement](https://app.notion.com/p/40595a7154058188873dd594ee4b7875). One branch, `feat/v2-feedback`; one PR per item or a few small ones together, as the owner prefers.

## The items

### 1. Updates download behind the header, and faster (Both, Now)

**Said:** the full page blocks Android; iPhone needs Update app by hand; every download feels slow ("like a minute", a feeling, not timed), on every phone. Why block anyone: download in the background, in the header, on every device.

**Plan:** in its own task file, `058_updates-in-background.md`: measure first on staging (the update is about 1 MB in 130 files, so seconds; the cause is not known yet), fix what is slow, then no full page on any open except after a 426.

**Done:** PR #113, released 2026.11.6 (2026-11-07): Workbox saved the files one at a time; our own worker saves 8 at a time, and every update downloads behind the header. The owner checks the next deploy on phones.

### 2. Store: the sales total is too small (Backoffice, Now)

**Said:** the green sales total on a store's range card (Sales, then Cups · Expected · Tea waste) is too tiny.

**Done:** `apps/backoffice/src/store/RangePanel.tsx`: from 18 px (`text-lg`, Inter bold, the same size as the tiles below) to 22 px bold with tight letter spacing, the same as the range title "Today" (`text-[22px] leading-tight font-bold tracking-tight`; 24 px was too big), the loading bar to match.

### 3. Store cards: Expected and Total in orange (Backoffice, Now)

**Said:** a store card's Expected (open) and Total (closed) cash should not be green: orange, as Actual Cash in a day's analytics, so it stands out.

**Done:** `apps/backoffice/src/store/StoreList.tsx`: `text-orange-600` (Actual Cash's, `packages/shell/screens/DayCard.tsx`) when one store's cash shows; the all-stores Sales figure stays green.

### 4. Store: a month picker in the date range (Backoffice, Now)

**Said:** the Date range sheet (Today, Yesterday, Last 7 days, Last 30 days, This month, Last month, Custom range) should have a month picker: people pick a month more than a custom range. So This month, and a month picker, instead of This month and Last month.

**Plan (to agree):** `apps/backoffice/src/store/range.tsx`: Last month becomes **Pick a month ›**, which opens the months (this year in a grid, ‹ › for other years, months after today greyed out); a month picked shows as its name ("October 2026") in the range title. Today, Yesterday, Last 7 days, Last 30 days, This month and Custom range stay. The range is already in the address (`from`, `to`), so nothing changes in Go.

**Done (2026-11-07):** `DateRangeSheet` (`packages/ui/controls`): **Pick a month ›** replaces Last month: a year of months, ‹ › for other years, a tap applies; `monthRange(month, today)`. A whole month is titled by its name ("October 2026"). The custom calendar always draws six weeks, so its height never jumps.

### 5. Analytics and Orders: the range picker on top (Backoffice, Now)

**Said:** on a store's (or All Stores') Analytics and Orders, the range picker should be at the very top, above the totals card; the totals stay.

**Done:** `apps/backoffice/src/store/AnalyticsMonth.tsx` and `StoreOrders.tsx`: `<RangeBar />` first, above the unclosed-days warning (Analytics) and the totals.

### 6. `/me` failing with 500 locally on production's database (Both, Now)

**Seen:** running `pnpm backoffice:prod`, `/me` answered 500: `max clients reached in session mode - max clients are limited to pool_size: 15`. Supabase's pooler (Nano) allowed 15 connections; production's services could hold all of them (api 8, worker 4, realtime 2, its LISTEN 1), so a laptop's Go, a deploy's second api, a backup or a `psql` could be refused.

**Done:** the owner raised the pool to 24 (Supabase, Database settings, Connection pooling; 40% of Nano's 60, since v1 uses Supabase's REST API heavily). PR #111: api 4, worker 2, realtime 1 (8 in all with the LISTEN; v1 uses Supabase's REST API, outside this pool), and `scripts/dev.sh` gives a laptop's Go 2.

### 7. A day: Who Worked and Sessions in one card (Both, Now)

**Said:** a day's Who Worked and Sessions are two cards saying nearly the same, Sessions with extra padding for no reason. One card: each person with their total time worked and their cups.

**Done:** `packages/shell/screens/DayActivity.tsx` `DayPeople`, used by `DayView.tsx` (both apps' day screen): one Who Worked card, a row per person (avatar, name, cups), their sessions under them as slim lines (from → to, Active, who they took over from, and its length at the right in a blue pill, the same shape as the cups pill). The separate counts row and inner white cards are gone. `Sellers` itself is unchanged (store list, store page, day card).

### 8. A day: the product breakdown in 3 columns (Both, Now)

**Said:** Product Sales Breakdown in 3 columns instead of 2, more condensed.

**Done:** `DayView.tsx`: `grid-cols-3`, tighter tiles (name and money 12 px, cups 14 px bold).

### 9. A day: the expenses inside the Cash Summary (Both, Now)

**Said:** the Expenses card at the bottom makes no sense; the expense lines belong inside the Cash Summary's − Expenses.

**Done:** `DayView.tsx`: the − Expenses tile lists each expense under its total (type, amount) in one lighter rounded box inside it (`bg-white/50`, no lines; the owner's pick of two sketches); the separate Expenses card is gone.

### 10. Close day looks like every other day (Seller, Now)

**Said:** the look must be the same; Close day only has the cash count on top.

**Done:** `DayView.tsx`: `counting` only adds the cash count first; the expenses sit inside the Cash Summary and Who Worked is the one card with sessions, in Close day as in both apps' day screens.

### 11. Close day: the first footer button scrolls down (Seller, Now)

**Said:** on Close day's last step, the footer button should not say Done at first: it should say something like Go down and take the seller to the bottom, where the confirmation checkbox is. Not now.

**Plan (to agree):** `apps/seller/src/home/CloseDay.tsx`: until the checkbox is ticked the footer shows **Review ↓**, which scrolls to the checkbox; once ticked it becomes **Done**, as today.

**Done (2026-11-07):** until the box is ticked the footer says **Review ↓** (brand) and scrolls to it; ticked, **Close Day** (red), as before.

### 12. Pay: the period card's total payout on the right (Backoffice, Now)

**Said:** the total payout on the left of the period card makes no sense: swap it with the pay date.

**Done:** `apps/backoffice/src/pay/Period.tsx`: the pay date and its status pill (days left, paid) on the left; Total payout and its amount on the right, right-aligned, in orange (money going out, like the store cards' cash), not green; each person's Total in the list below too.

### 13. Pay: a person's badges and total on one line (Backoffice, Now)

**Said:** on a person's row in the period list, the bottom of the badges (Ready, 17/17 ✓) and the bottom of the total do not line up: flex, not a grid.

**Done:** `Period.tsx`: the row's head is a 2-row grid (name and Total, then the badges and the amount), the amount's line 20 px like a badge, both on one bottom line.

### 14. UAC: a person's arrow level with their name (Backoffice, Now)

**Said:** in the UAC people list, the › should sit at the top, level with the name, not in the middle of the row.

**Done:** `packages/ui/layout/ListRow.tsx`: with `top` (only UAC's people list uses it), the chevron goes to the top with the avatar, level with the title. Every other list keeps it in the middle.

### 15. UAC: a person's sessions, each one ended on its own (Backoffice, round 7)

**Said:** the person page's Log Out button (Step 52's "log a person out") does not make sense on its own. What makes sense: see the person's sessions (which device, which app, the basics already stored) and delete a bad one from there, as backoffices do; on 2026-11-04 a dead session looped and could only be removed in the database.

**Plan (to agree):**
- Go: `GET /tenants/{tenant}/uac/people/{userId}/sessions` (backoffice admin) lists what `sessions` already holds: app, signed in (`created_at`), last seen (`last_seen_at`), expires, IP, and the device read from `user_agent` (for example "iPhone · Safari", "Android · Chrome", "Mac · Chrome"), the raw user agent too. `DELETE …/sessions/{sessionId}` (admin, `.Repeatable()`) ends one session; Go forgets it at once and tells the hub, so that phone's socket closes and it lands on sign in. Only sessions of people in the caller's tenant; the owner's sessions only by the owner
- Screen: the big red Log Out button leaves the person's page (too easy to press by accident). In its place a **Sessions** card, read only: one row per session (device, app, last seen, signed in, IP), no buttons, and **Manage ›** at its foot. Manage opens its own page, `/uac/{userId}/sessions`: the same rows, each with its own Log out, and **Log out everywhere** at the bottom, asking first. Nothing on the person's page itself ends a session
- No migration: the columns exist

**Done (2026-11-07, round 7, agreed as planned):** `GET /tenants/{tenant}/uac/people/{userId}/sessions` (backoffice admin) and `DELETE …/sessions/{sessionId}` (admin, `.Repeatable()`, `session_not_found` when already gone, `owner_kept` for the owner's unless the owner). The device from `domain.Device` (unit tested); `current` marks the caller's own. Ending one forgets the person in Go's cache and announces `signed_out`, so the hub closes that session's socket and their other phones stay in. Screen: the person's page has a read-only **Sessions** card (device, app, Active today/yesterday/date, IP; This device), **Manage ›** beside its title for those who may end them; `/uac/{userId}/sessions` has Log out per row (not on this device) and Log out everywhere inside the card, red as Update now (asks first; not on your own page); a laptop's `::1` is not shown. `last_seen_at` moves at most once a day (the session renews daily), so it says the day, not minutes. Integration test `TestUacSessions`.

### 16. The idle "refresh" sheet goes; coming back refreshes with the header loader (Both, Now)

**Said:** the bottom sheet telling the user to refresh made sense in v1, not in v2: the app already refreshes on its own when it comes back, but without the header loader, so nobody sees it. Trigger the header loader, and remove the sheet.

**Today:** `packages/shell/frame/RefreshSheet.tsx` shows a sheet after 20 minutes without a tap; its button refetches every query in place (`navProgress.run(queryClient.invalidateQueries())`). Separately, the live socket closes 60 s after the app is hidden (`packages/api-client/live.ts`) and, when it opens again, refetches every screen on view (`resync`), quietly.

**Plan (to agree):** the sheet becomes a component that draws nothing:
- **Coming back** after the app was hidden 60 s or more (the same as the socket's): the queries on screen refetch in place, under the header loader (`navProgress`), and `refreshGate` is marked, so a pull right after does not ask again; the socket's own resync then finds them fresh
- **Left open 20 minutes without a tap** (a dashboard on a table): the same refetch, instead of the sheet
- The POS cart survives (a refetch in place, as the sheet's button did); the sheet's words and emoji leave `packages/i18n` if nothing else reads them

**Done (2026-11-07):** `RefreshSheet` removed; `frame/ComeBackRefresh.tsx` draws nothing: away 60 s or more, or 20 minutes without a tap, refetches the screens on view in place under the header bar (`frame/refreshAll.ts`), never while a new build is about to reload. The socket's catch-up after a gap (`startLive(queryClient, onGap)`) goes through the same `refreshAll`, gated by `refreshGate`, so coming back fetches once, not twice. The sheet's words left `packages/i18n`.

### 17. Seller: the store picker is gone (Seller, Now)

**Said:** the seller's store picker is gone, again; a common bug, is it local storage?

**Found:** not storage: nothing draws it. Backoffice refinement (#50, 2026-10-28) took the picker out of the shared header, since the backoffice picks a store in its Store list; the seller app, built after, never had it back. `StorePicker` still existed, unused.

**Done:** `packages/shell/frame/MobileHeader.tsx` takes `beside`; `MobileShell.tsx` puts `StorePicker` (`inline`) there, beside the big title as in v1 ("POS Pagelaran ⇅"; first put above it, wrongly), on a tab's home when the app works in one store (`app.config.ts` `stores: "one"`, the seller), not on More. The backoffice is unchanged.

### 18. Seller: no avatar on Manage (Seller, Now)

**Said:** on Manage, the profile icon top right is gone.

**Found:** the avatar shows only on a tab's home (`rootTabPaths`); Manage is POS's other face (`variant`), its address was not in the list, so the header treated it as a page under the tab.

**Done:** `ShellLayout.tsx`: `rootTabPaths` includes each tab's variant, so Manage is a home: the avatar, and the store picker.

### 19. At a Glance: clear markers, and no hours under the bar (Seller, Now)

**Said:** some of the bar's markers have no colour (the expense $ is see-through); and the bar shows no times, where v1 shows each hour under it.

**Found:** the colours live in `packages/shell/screens/dayEvents.ts`, and `packages/ui/styles/globals.css` told Tailwind to scan only `.tsx` in the shared packages: a colour used nowhere else (`bg-orange-400`, expenses) was never generated. It could hit any class kept in a `.ts` file.

**Done:** `globals.css` scans `{ts,tsx}` in `packages/ui` and `packages/shell`. `apps/seller/src/home/HomeHeader.tsx`: the hour labels under the bar, as v1 (each hour where it starts, the buffer before opening skipped, `text-[10px] text-gray-400`, "10 AM").

### 20. Seller: no date pickers on Orders and Analytics (Seller, Now)

**Said:** most looking back is done in the backoffice now, so the seller app does not need the date picker on Orders, and Analytics needs no month picker: it shows the last 30 days on its own, and its Totals card says "Last 30 days".

**Done:**
- **Orders** (`apps/seller/src/home/Orders.tsx`): the Select Date card is gone; today's orders only (owner: today only), the totals card titled Total today (`orders.totalToday`, new)
- **Analytics** (`apps/seller/src/home/Analytics.tsx`): the Select Month card is gone; the last 30 days (today and the 29 before), the totals card titled Last 30 days (`store.last30`, the backoffice range picker's words), the chart and the days list over the same 30 days
- Go unchanged: both screens already asked by a date range

**Reversed (owner, 2026-11-08, #135, released 2026.11.12):** the pickers are back: Orders picks a day (the calendar only), Analytics a month (the month grid only), this month and the two before; Go refuses a seller anything earlier (`too_far_back`). The Totals heading is gone in both apps; totals are tiles in one card with the chart.

### 21. A day's activity: the opening photo's label shows its key (Both, Now)

**Said:** in a day's Activity, the opening photo is labelled `store.photo.opening`.

**Done:** `packages/i18n/areas/store.{en,id}.json`: `store.photo.opening`, the same words as the day view's opening photo (`daily.photoOpening`). The photo labels covered only the five closing photos.

### 22. Seller: a nicer My Stores (Seller, Now)

**Said:** the My Stores page looks lame.

**Done:** `apps/seller/src/more/MyStores.tsx` on the shared `ChoiceList` (the radio list of Language and UAC): one row per store with its hours, Default and Inactive in the line under the name, the store in use chosen; tapping another active store switches to it (the header's picker follows). Inactive stores cannot be picked. (First built with list rows and a ✓; the owner asked for a radio button.)

### 23. Local: the two apps sign each other out (Both, Now)

**Seen:** running both apps locally, switching between them signs you out. Both run on `localhost`, and browsers share cookies across ports: signing in to one replaced the other's `session`, so Go refused it (the wrong app).

**Done:** `packages/config/vite.ts` (the local proxy only, never in production): the browser keeps `session_<app>` (`session_seller`, `session_backoffice`), renamed to `session` on the way to Go and back on the way out; the socket's proxy too. Go is unchanged. Each app needs one sign-in after the restart.

### 24. Small ones the owner agreed (Backoffice, Now)

- **Orders' totals card says Totals,** not Daily Summary (a range can be many days), as Analytics: `apps/backoffice/src/store/StoreOrders.tsx`. The seller's Orders says Total today (item 20)
- **The payslip's Total Pay in orange** (money going out, as the period card): `apps/backoffice/src/pay/Payslip.tsx`
- **Store cards: the status pill and the amount on one line,** the same 2-row grid as Pay's rows (item 13): `apps/backoffice/src/store/StoreList.tsx`

### 25. UAC: a person's app levels as a radio list (Backoffice, Now)

**Said:** the Apps page's levels (Seller: None · Member; Office: None · Guest · Admin) should be a radio button, like My Stores.

**Done:** `apps/backoffice/src/uac/PersonPage.tsx` `AppLevels`: the shared `ChoiceList` per app instead of `Segmented`; each level shows what it means under it (the hint once shown only for the chosen one).

### 26. Store settings: create, edit, change status, delete stores (Backoffice, written down, to build: Go and screens)

**Said:** the backoffice Store section should also manage stores, as Pay has Pay settings: create a store, change a store's status, delete one. Store CRUD.

**What a store is today** (`stores`): name, address, latitude and longitude, status (`active`, `fake` for demo, `inactive`), open and close time, tenant. Orders, days, sessions, expenses, photos, claims and commissions all point at it.

**Plan (to agree):**
- **⚙ on the Store home** opens **Store settings** (`/store/settings`), as Pay's ⚙: the tenant's stores, active first, then demo, then inactive; **+** adds one
- **A store's page in settings** (`/store/settings/{storeId}`): name, address, opening hours (open, close), status (Active, Demo, Inactive as a radio list), the location (latitude and longitude; a map later, if ever); Save
- **Delete is a soft delete** (owner, 2026-11-06): nothing that points at the store is removed or changed (no cascade: its orders, days, sessions, expenses, photos, claims and commissions stay as they are, and so do the sales and pay screens over past dates). The store gets `deleted_at` (a new nullable column, the one migration here, additive) and is hidden from every v2 list and picker from then on. It also turns `inactive`, which v1 already understands, so v1 stops offering it too. Asks first. **Deleted stores** at the foot of Store settings can be restored
- **Go:** `POST /tenants/{tenant}/stores`, `PUT /tenants/{tenant}/stores/{storeId}`, `DELETE /tenants/{tenant}/stores/{storeId}` (sets `deleted_at`), `POST …/{storeId}/restore`, backoffice admin only; every list of stores in Go skips deleted ones except where history is read by date; `.Idempotent()`; announced on `tenant:` so every open app sees the new list (the pickers, My Stores). Who works at a store stays in UAC (a person's stores)
- **v1:** reads the same `stores` table, so a store made here shows in v1 too; check v1's store list before building (fields it needs that v2 does not set)
- One migration: `stores.deleted_at timestamptz` (nullable, additive, so v1 never notices)

### 27. Correct a day from the backoffice (Backoffice, written down, to build: Go and screens)

**Said:** when a seller gets an input wrong (the opening balance, an expense) and tells us, an admin fixes it in the backoffice, on the day itself. Management of a day, for mistakes. (On 2026-11-04 an opening balance had to be fixed in production's database by hand: 286k to 306k.)

**The architecture RFC's Step 40b** (correcting mistakes) covers this; this item is its first part.

**Plan (to agree):**
- **On a day's page in the backoffice** (shared `DayView`), for admins only: an **Edit** action (✎ in the header) opening **Correct this day**
- **What can be corrected:** the opening balance; the expenses (add one, change one's type or amount, remove one); on a closed day also the counted cash. Each correction recalculates what depends on it at once: expected cash (opening + sales − expenses), and on a closed day the variance (counted − expected), as by hand on 2026-11-04
- **Every correction is logged** on the day's activity (who, when, before → after, a short reason typed by the admin), so the seller's and the owner's view both show what changed and why. Announced live (`day`), so an open seller app refreshes
- **Go:** `PUT /tenants/{tenant}/days/{dayId}/opening-balance`, the expenses' existing routes opened to backoffice admins on any day, `PUT …/actual-cash` on a closed day; each in one transaction with its activity row, backoffice admin only, `.Idempotent()`
- **Orders too** (owner, 2026-11-06): on the day's orders, an admin can **edit** an order (its items and quantities, so its total and cups) or **delete** it. Delete is a soft delete, as stores (item 26): the order is kept, never removed, and left out of every total. **Decided** (owner, 2026-11-07): a column, `store_orders.deleted_at` (nullable, additive), as stores. Known until v1 retires: v1 does not read it, so a seller still on v1 keeps seeing a deleted order in their own day's totals. Each recalculates the day's sales, cups and expected cash, and the seller's commission for that day while its pay period is not paid; once paid, the order is locked (a correction would change money already sent) and the screen says so. Logged and announced like the rest
- **Later, not here:** a seller asking for a correction from the app (Requests, with chat)

### 28. More: which build a phone runs, and whether it is the latest (Both, Now)

**Said:** show the version under the App info row on More, so it is easy to tell whether a phone is on an older build or the latest.

**Plan:** `packages/shell/screens/MoreScreen.tsx`: the App info row gets `sublabel={currentVersion()}` (from `frame/AppUpdate.tsx`: `2026.11.6`, or `staging` on staging). Suggestion the owner can strike out: when a newer build is found or downloading, the line adds "· Update available", so older vs latest is plain without opening anything.

**Done (2026-11-07), as agreed:** the Update app row says the build and where it stands, one line: `2026.11.7 · ✓ Latest`, `· ↓ 2026.11.8 42%`, `· Ready, restarting`, `· 2026.11.8 available`, `· Offline`; on staging the commit instead of the word (`f828949 · ✓ Latest`). It reads `version.json` (no API), on opening More and whenever the header asks. App info: App version, App commit, Latest build (✓ when it matches). Locally (no `version.json`) no state is shown, not Offline.

### 29. Seller Orders: the chart shows with no orders yet (Seller, Now)

**Said:** with no orders, the hourly chart is missing and only "No orders found" shows; rather see the empty chart.

**Plan:** `apps/seller/src/home/Orders.tsx`: the chart is drawn while `day.hours` is empty too, over the store's opening hours (`openTime` to `closeTime` from the tenant's store) at 0 cups; check `AreaChart` draws a flat line when every value is 0 (no divide by zero). The "No orders found" card goes (the chart and the 0s say it); open question for the owner: keep a one-line "No orders yet" under the chart, or nothing.

**Done** (owner, 2026-11-07: build it now): the chart over the store's hours at 0 (10 to 22 when the store has no hours); the card stays, with item 30's circle.

### 30. Seller Orders: the empty card's icon on a grey circle, as Chats' coming soon (Seller, Now)

**Said:** keep the calendar icon, add the grey circle behind it, the same as the coming-soon card (`ComingSoon`: `size-24 rounded-full bg-gray-100`, icon `size-12`).

**Done:** `apps/seller/src/home/Orders.tsx`. If item 29 removes the card, this goes with it.

### 31. Every empty card: a Lucide icon on a grey circle, as Chats' coming soon (Both, Now)

**Said:** the ghost goes, wherever it shows (What's New and every other empty card); a Lucide icon on the grey circle, with Chats' sizes (title `text-sm` medium grey, line `text-xs`). No orders uses Receipt Text, the footer's Orders icon.

**Done:** `packages/ui/feedback/EmptyState.tsx` is that card (an `icon`, Inbox by default); `ComingSoon` is the same card a screen tall, so the two never drift. Orders in both apps (`apps/seller/src/home/Orders.tsx`, `apps/backoffice/src/store/StoreOrders.tsx`) pass `ReceiptText`; item 30's hand-made card is replaced by it. `ghost.svg` removed (its only user). Inbox stays the default (owner, 2026-11-07: fine for now); a screen can pass its own icon later.

### 32. Pay: no text tick on the approved count (Backoffice, Now)

**Said:** the `21/21 ✓` badge on a person's row in a pay period uses a plain tick; Circle Dashed or Badge Check reads better.

**Done:** `apps/backoffice/src/pay/Period.tsx`: Lucide's `BadgeCheck` after the count (approved of reviewed), instead of the `✓` character.

### 33. An order's card: a ⋮ menu top right, opening a bottom sheet (Both, Now: the look; edit and delete with item 27)

**Said:** orders become editable (item 27), so the card's look changes: a kebab (⋮) top right, as the day card's, opening a bottom-sheet menu.

**Plan (layout to agree, ASCII shown to the owner first):** `packages/shell/screens/OrderCard.tsx`, the ⋮ as `DayCard`'s (`MoreVertical`, same button); the sheet the shell's `Sheet`. Menu: Edit order, Delete order (item 27, backoffice admins only, asks first; locked once the pay period is paid). Where nobody may change it (the seller app, a guest), the ⋮ shows nothing to change, so it is hidden (or only a Copy ID; the owner's call). Suggestion: the Order details block (ID, seller, full time) moves into the sheet, so the card is the order and its items.

**Done, the look only** (owner, 2026-11-07, layout A of three: the total fought the ⋮ in the corner): `packages/shell/screens/OrderCard.tsx` reads like a receipt: `Order #81 · QRIS` with ⋮ alone top right, `time · store · seller` under it, the items in a slate box (`3×  Original  Rp 15.000`, unit price under), then, inside the box as a receipt's last line, `Total · 4 cups` grey and the amount green (owner, 2026-11-07: the foot row outside the box felt awkward; `1 cup`, not `1 cups`). The header (owner, 2026-11-07, after trying icons): `Order #747` (QRIS badge) with ⋮; `6 Nov, 21:56 · Pagelaran` grey, no icons; then the seller with their photo (`Avatar`, 24 px). **Go:** orders now carry `sellerAvatar` (`users.avatar_url` in `ListDayOrders`; contract, sqlc, openapi and the client regenerated). ⋮ opens a sheet with the full time, seller, store and the ID to copy. Edit and Delete are not in the sheet yet: they arrive with item 27, so nothing on screen does nothing. Unused now: `orders.orderDetails`, `orders.items` (cleanup).

### 34. Weather: Rain and Light Rain swapped (Both, Now)

**Said:** the Notion bug [Weather codes 4001/4200 swapped](https://app.notion.com/p/3ed95a7154058182a7f1cc14ef6090ac) (Planning, Low): is it fixed? Not yet: v2 copied it from v1. Tomorrow.io's codes are `4001` Rain and `4200` Light Rain; `packages/ui/lib/weather.ts` says the opposite (v1's `packages/utils/weatherCode.ts` too).

**Plan:** swap the two keys in `packages/ui/lib/weather.ts` (`4001` → `rain`, `4200` → `lightRain`); both keep the rain cloud icon. v2 only (owner, 2026-11-07: v1 stays as it is). Then the Notion task to Done.

**Done (2026-11-07):** `4001` → `rain`, `4200` → `lightRain`. The Notion task to Done after release.

### 35. Never stuck on the first loader (Both, Now)

**Said:** sometimes the app sits on the opening loader for ever; killing and reopening fixes it. Middleware, no token, or the update? Will it happen again?

**What can hold the splash today** (read 2026-11-07, not reproduced): the splash waits for `/me`, from the phone's saved copy or the network (`ShellLayout.tsx`). The saved copy is dropped whenever the API's contract changes (`buster: API_CONTRACT`), and after a forced update. Then `/me` must come from the network, and the fetch client has **no time limit**: a request that hangs (an iPhone waking with a dead connection is the usual one) keeps the splash up until the app is killed. A failed answer is handled (the retry screen); a hang is not. Also unguarded: the language file loads before anything draws (`startApp`), and a script that never loads leaves only `index.html`'s splash. Not the cause: a missing session or an inactive user answers at once (sign-in, task 057). The old full update page could also sit for up to 60 s (`DOWNLOAD_LIMIT_MS`); gone since 2026.11.6. **The owner saw the splash with the logo, not the update page** (2026-11-07), so the hang is the likely cause.

**Plan:**
- `/me` gets a time limit (`AbortSignal.timeout`, about 15 s, `packages/api-client`): a hang becomes an error, so the retry screen shows, and Retry asks again
- A watchdog in `index.html` (inline, no dependency): if the app has not lifted the splash in about 20 s, the splash shows a Reload button (covers a script or language file that never arrives)
- Report both to PostHog when they fire (`boot_stuck`, with which one), so we learn how often and why

**Done (2026-11-07):** `/me` gives up after 15 s (early fetch and `useMe`), a timeout shows the retry screen at once (no retries); index.html's watchdog adds "Taking too long" and **Reload** to the splash after 20 s; both reported as `BootStuck` (the watchdog's also by the next load, through `tea-pos:boot-stuck`). Checked locally behind a server that never answers. Also: the splash's logo and bar fade in only after 0.4 s, so a fast open shows none (owner: keep it simple, no flash).

### 36. Toasts and failed saves as clear as v1's (Both, Now)

**Said:** v1's toasts and the way it shows an error response are better than v2's; improve ours, looking at v1.

**v1** (`../tea-pos/apps/seller/lib/context/ToastContext.tsx`, `ErrorSheetContext.tsx`, `packages/ui/custom/ErrorSheet.tsx`): toasts by kind (success green, error red, warning amber, info blue), each with its icon, a line and an optional second line, sliding down from the top; a failed save opens an **error sheet**: the status as a red badge (`422 · Unprocessable Entity`), a plain title for it, the server's message, a grey box with the time, the address and the status, **Copy details**; a failed background load is one toast per 10 s.

**v2 today:** one kind of toast (`packages/ui/toast/Toast.tsx`): dark grey text at the bottom, no icon, no kind; a failed save is only that toast with the translated code (`useApiMutation`'s default `onError`); background load failures the same toast, once per 10 s (`useErrorToasts.ts`).

**Plan (to agree):**
- `toast(text, { kind, detail, action })`: kinds success, error, warning, info, inspired by v1's colours and Lucide icons and made better (owner's words), an optional second line, an optional small action (Details), at the top under the header as v1; plain `toast(text)` stays info, so today's calls keep working; the saves that say "saved" pass `success`
- **A failed save is a red toast, not a sheet** (owner, 2026-11-07: most failures are expected, a wrong amount, a closed day, and a sheet each time alarms a seller and blocks the screen mid-order): the translated title (`errors.<code>`, as now) and Go's message as its second line, about 6 s instead of 4, and a small **Details ›** on it. `useApiMutation`'s default `onError` shows it; a screen that shows the error on its field keeps doing so
- **Details opens the error sheet** (shell, on the shared `Sheet`): the code as a red badge (`422 · invalid_input`), the title and Go's message, then a details box: time, the request (method and path), status, code, **the request id** (Go's `X-Request-Id`, so a screenshot or the copied text finds the log line; v1 never had it), the app version; **Copy details**. Sellers are told: when something fails, tap Details and send a screenshot. A 500 does not open it by itself: Go already sends every error it logs to PostHog with its request id
- Background load failures stay a toast (now the error kind), once per 10 s; the quiet codes (sign in, maintenance, update, the brake) stay quiet
- Offline is a warning toast, not the sheet (nothing to report)

**Agreed (2026-11-07):** toasts as option A (v1's: a white card, the kind's icon in colour, at the top; about 3 s, errors about 6 s; a new one replaces the last). Errors split by code: an **expected** code (a short list the person can act on: `store_closed`, `day_closed`, `conflict`, `not_allowed`, `read_only`, a field they filled wrong) is a red toast with Details ›; **everything else is broken** and opens the error sheet by itself (5xx, 400/422 from a shape the app sent, 404 on a save, a code the app does not know, an answer that is not our JSON, a request failing while online). The default is the safe side: a forgotten code opens the sheet and gets noticed. The sheet: status · code badge, our words, Go's message, time, method and path, status, request id, app build, Copy details. Being offline is not a toast (item 41).

**Done (2026-11-07):** `toast(text, {kind, detail, action, ms})` (`packages/ui/toast`): at the top, a white card with the kind's icon, one at a time, tap or swipe up to dismiss. `showFailure` (`shell/session/failed.ts`) for every save (`useApiMutation`'s default, Language): connection failed: amber "Not saved"; an expected code: red toast + Details ›; broken (`BROKEN`, 5xx, unknown or missing code): `ErrorSheet` opens by itself. The fetch client records each failure (`api-client/failures.ts`: method, path, status, code, message, `X-Request-Id`) for the sheet; Copy details copies it all. Background load errors: red toast once per 10 s; connection failures say nothing there (item 41). Success toasts marked `success`.

### 37. Seller: pull to refresh, as the backoffice (Seller, Now)

**Said:** the seller app has no pull to refresh; the backoffice does.

**Done:** the shell already has it per route (`staticData.shell.refreshable`); the seller's routes never set it. On now for the screens that show data: Orders, Analytics, a day and its activity, Manage, Expenses, My pay and a payout, My claims. Left off: POS (a pull while scrolling the menu would refetch mid-order), the forms (open store, close day, add expense, new claim), Chats, Account, My stores, What's new, App info.

## Done when

- Every item marked Now is built, checked and merged into staging, and the RFC says what was done
- Every item marked Later is in the RFC with when

### 38. Changing language lags and flashes (Both, Now)

**Said:** in the seller (and the backoffice), picking a language feels glitchy: a lag, then an overlay as the app reloads.

**Today:** `packages/shell/screens/LanguageScreen.tsx` saves to `/me`, refetches `/me`, then `window.location.reload()`: the whole app starts again, splash and all.

**Plan (to agree):** switch in place, no reload: save, load the new language's core and the areas already loaded (`packages/i18n`), and swap the provider's messages, so the screen just changes words. If the save fails, nothing changes, as today.

**Done (2026-11-07):** `packages/i18n`: `messagesFor(locale)` loads the core and every area already loaded, `activate` makes it the active language; `I18nProvider` holds it in state, `useSwitchLanguage()` swaps it (and `<html lang>`). Language: words first (no signal: a toast, nothing changes), then `/me`, then the switch; `useMeSync` switches the same way instead of reloading.

### 39. A brief flash while loading, and a lighter skeleton (Both, Now: 1 and 2; 3 later)

**Said:** sometimes, on some screens or while loading, a short flash. Is it a screen without a skeleton?

**Said, more (2026-11-07):** not one screen: on the backoffice, tapping the range's ‹ › quickly flashes; and generally a split second during a fetch.

**Cause:** no query keeps its old data while a new key loads (no `placeholderData` anywhere). Each ‹ › is a new range, so every card drops to its skeleton for the fetch, then back: the flash. A range already seen comes from the cache and does not flash.

**Said, more:** not one page: any fetch can flash. What do production apps do? Not every screen uses our skeleton yet. Can the skeleton be lighter?

**What apps usually do:** a skeleton only when there is nothing to show (a first visit); with something on screen (a refetch, the next range) the old content stays until the new arrives; no skeleton for a fast fetch (under ~200 ms).

**Today:** about 30 files use `Skeleton`; others draw their own (`…`, a grey box, an empty block). The skeleton shows at once, so a fast fetch blinks. Its sweep animates `background-position`: a repaint every frame for every skeleton, the costly kind on a Galaxy M11.

**Plan (agreed to list, 2026-11-07):**
1. `packages/ui/styles/globals.css` `.skeleton`: a soft opacity pulse instead of the sweep (compositor only), faded in after ~200 ms, so a fast fetch shows none. One change, every screen
2. The range screens (backoffice Store, Analytics, Orders; seller Analytics) keep the last range's data while the next loads (`placeholderData: keepPreviousData`), slightly faded; not app-wide: another store or day never shows the last one's data
3. A sweep of every screen's own placeholder (`…`, grey boxes, empty blocks) to the shared `Skeleton`

**Done (2026-11-07):** 1. `.skeleton`: an opacity pulse, faded in after 200 ms; the update bar keeps its sweep (`.sweep`). 2. Backoffice range queries keep the last range's data while the next loads, same tenant and stores only (`sameStores` in `store/sales.ts`, `keepWhile` on `useInfiniteList`); no fade, the numbers just change. 3. Still to do.

**39.3 done (2026-11-07):** the last hand-made placeholders (grey boxes, "–" and "…" while loading, an empty block for the chart) use `Skeleton`/`SkeletonChart`; `Tile` takes `undefined` while loading. A "–" that means none stays.

### 40. Order card, round 3 (Both, Now)

**Done (2026-11-07):** the header says the full date and time · store, then the seller; ⋮ opens only the ID to copy; a divider, then Total · cups and the amount (16 px bold, green), flush with the box; secondary text gray-700; padding p-3 as the day card. Unused translation keys removed (`daily.session(s)/person/people`, `orders.orderDetails/items/fullTimestamp/seller/store`, `store.lastMonth`).

### 41. Online and offline in the header (Both, Now)

**Said:** show beside the avatar when the phone is offline or the connection is bad (Lucide's wifi icons), and a tap opens a sheet saying so with details: better than toasts again and again.

**Plan (agreed):** nothing shows when all is well. Offline (the browser's `online`/`offline` events): `WifiOff` in red. Connected but the API not answering (a request failing on the network, or `/me`'s time limit): `WifiLow` in amber, cleared by the next answer. A tap opens a sheet: since when, what still works (what is on the phone), what happens to a save (to check first: whether a save made offline waits or fails, and say exactly that), the last answer from the server, Try again. One toast when the phone goes offline, then only the icon; coming back is quiet (the icon goes). A save failing for no connection still says so once ("Not saved: no connection").

**Done (2026-11-07):** `api-client/connection.ts`: `offline` from the browser's events, `slow` from a request failing on the way, the time limit or Cloudflare's 502/504/522/524, cleared by the next answer. `frame/ConnectionIcon.tsx` beside the avatar: `WifiOff` red, `WifiLow` amber, nothing when fine; a tap opens a sheet (since, last answer, Try again = `/health`). One toast on going offline. Offline saves: React Query holds a mutation until the phone is back (its default `networkMode`), so the sheet says a save waits while the app stays open.

**Redone (round 6, 2026-11-07):** the owner tried it on staging and disliked an icon always in the header: most of the time nobody cares. As Spotify and YouTube: a banner under the tabs, only when in trouble, text only (`frame/OfflineBanner.tsx`): No connection / Can't reach the server (dark grey), Slow connection (amber), then Back online (green, 2 s) after offline or failing. The icon, its sheet and the offline toast are gone; `connection.ts` keeps only the level. Locally `?preview=offline|failing|slow|back`.

**Also round 6:** a generic "Something went wrong" toast on staging with nothing failing in Railway's logs: a request the app cancelled (a screen left before its data came). Cancels never toast now, for loads or saves, and any error without one of our codes is reported to PostHog with its name, message and where (the query key, or save).

### 42. App info, once more (Both, Now)

**Done (2026-11-07, after 2026.11.8):** More has one App info row: `2026.11.8 (a3238a0) · Latest` (`staging (…)` on staging); behind, no words but a full-width red **Update now** under a divider, inside the same row (`SettingsRow`'s `below`); App info the same (App version, Update: Latest/Offline, or the button). The Update app row is gone. Locally `version.json` answers this build; `UPDATE_PREVIEW=1` answers a newer one, to see the button.

### 43. Pictures load with a pulse, never iOS's "?" (Both, Now)

**Said:** a picture sometimes shows a question mark instead of loading.

**Done (2026-11-07):** iOS Safari draws a "?" box for a picture that fails (offline, a bad connection). `ui/feedback/Picture.tsx`: the skeleton's pulse while it loads, a faint picture icon if it fails (avatars: their person placeholder), another try on the `online` event. Used for avatars (and the header's), POS products, day photos, the pay receipts. Local previews (the photo just taken, the logos) stay plain `img`.

### 44. Taking a photo: preview, Retake and Remove below it, as v1 (Both, Now)

**Said:** in v1 a taken photo shows on black and a tap opens it full screen; there is a Retake and a remove. v2's tile looks worse, and tapping it opens the camera again. Keep Retake and Remove, but below the photo, not on it: Open store and Close day take many photos.

**Plan (agreed; the owner asked for a boxy tile with black bars left and right):** in `ui/photo/PhotoInput.tsx`, once a photo is in:

```
 ┌──────────────────────────┐
 │██████████████████████████│  black, 2:1, the photo fitted (object-contain): bars left and right
 │██████    photo     ██████│  tap: full screen (ImagePreview)
 │██████████████████████████│
 └──────────────────────────┘
 [ ⟳ Retake ]    [ ⊖ Remove ]   two grey buttons under it, half width each
```

- Empty: as now (dashed tile, camera icon, the caller's words); while shrinking and uploading: the bar
- Retake opens the camera (or the gallery for screenshots) and replaces it; Remove clears it (a new `onRemove` from the caller, which clears the form's value)
- A failed upload: the tile says so, tap to try again; Retake and Remove still below
- Every caller: Open store, Close day, My claims, Pay confirm
- v1's camera-blocked sheet (steps to allow the camera) comes too, if the owner wants it: a suggestion

**Done (2026-11-07, round 6):** the tile is 2:1 in every state (square was too big, the owner said) (empty, uploading, done), so nothing jumps. Done: on black, fitted, a tap opens `ImagePreview`; Retake and Remove below (`common.retake`/`remove`: Retake/Foto ulang, Remove/Hapus). Taking a new photo or Remove calls the caller's `onRemove`, so Next stays off until the new one is in. Close day: removing a saved photo counts as no photo until one is taken. The camera-blocked sheet: not built, waiting on the owner.

### 45. Small ones before the release (Both, Now)

**Done (2026-11-07, `fix/settings-row-top`):**
- A settings row's icon and chevron sit level with its label, not the row's middle, as UAC's people; the row's second line is gray-700, not the lighter gray-500
- App info: App `2026.11.9 (88040d4)`, Server `2026.11.8 (a3238a0)` (older after a release that only changed screens), Build: Latest or Outdated with Update now under it; no Connected and no Offline (the banner says it). Account's footer shows the same app version (it said "API version")
- The date range sheet opens where the range came from: a picked month in the months, a custom range in the calendar
- Seller My Pay (was a year) and My Claims (was the phone's month input): `MonthStepper`, ‹ › step a month, a tap on the month opens the months sheet (`MonthGrid`, shared with the date range)
- No picker goes before the first data: `FIRST_MONTH` 2025-08 (the first store and order, read on production by the owner), `FIRST_PAY_MONTH` 2026-06 for My Pay, My Claims and the backoffice's Pay (`ui/controls/MonthStepper.tsx`)

### 46. Pickers start at the tenant's own start (Both, Now)

**Said:** the first month should not be fixed in code: take it from the tenant's created date. The tenants table came after the stores, so the owner set `tealicious`'s `created_at` to its first store's (2025-08-09) on production, 2026-11-07; staging still says 2025-10-03.

**Plan:** `/me`'s `MeTenant` gains `since` (the tenant's `created_at`, a date); `MonthStepper`, `MonthGrid` and the date range take their first month from it, `FIRST_MONTH` only as the fallback. Pay keeps `FIRST_PAY_MONTH` (pay began 2026-06). No migration.

**Done (2026-11-07, in #123):** `MeTenant.since` (the tenant's `created_at`, a date); `useFirstMonth(pay)` in `shell/session/tenant.tsx`: the tenant's month, or `FIRST_MONTH` before /me; with `pay`, the later of it and `FIRST_PAY_MONTH`. The date range (`firstMonth`), Orders' date field, My Pay, My Claims and the Pay period read it.

### 47. API docs in the backoffice, for the owner (Backoffice, Now)

**Said:** the API reference in the backoffice, owner only, to read on the phone; the summaries checked.

**Done (2026-11-07, in #123):** Go serves `/docs` and `/openapi.yaml` everywhere: open on a laptop (`Docs`), elsewhere only to a backoffice session of a tenant's owner (`OwnsATenant`), anyone else gets `route_not_found`; `TestDocsOwnerOnly`. The page drew nothing (its scripts came before `<body>`): fixed, with a phone viewport. The spec's server is `/api`, so Test Request reaches Go. More → API docs (owner only) opens it inside the app under the header (`/$tenant/api-docs`, an iframe). Every summary read against its handler: all accurate; `/me`'s now names its flags and asked tenants too.

### 48. Seller: demo stores shown as Inactive (Seller, Now)

**Said:** on production, changing store shows every demo store as inactive; the screen or the API?

**Done (2026-11-07, in #123):** the screens only: Go never refuses a demo (`fake`) store. The seller app treated anything not `active` as inactive. Now, as v1: My Stores labels a demo store Demo and lets it be picked, the header's sheet lists it, and a saved demo store stays chosen; only an inactive store is greyed out. A fresh phone still lands on an active store first.

### 49. Store settings without the migration: item 26's first half (Backoffice, Now; the delete button removed at the owner's request, the endpoint kept)

**Said (2026-11-07):** the Store page lists only the real stores, which is right; but a button should list every store and change the basics: location, status (active, inactive), and so on. No migration.

**Plan (to agree):** item 26 minus delete (delete needs `deleted_at`; Inactive does the job meanwhile).
- **⚙ on the Store home** opens **Store settings** (`/store/settings`): every store, active, then demo, then inactive, each with its status
- **A store's page** (`/store/settings/{storeId}`): name, address, opening hours (open, close), status (Active, Demo, Inactive, a radio list with what each means), latitude and longitude; Save asks first
- **Go:** `PUT /tenants/{tenant}/stores/{storeId}` (backoffice admin, `.Idempotent()`), checked: hours `HH:MM`, open before close, latitude -90..90, longitude -180..180, name not blank; announced on `tenant:`, so the pickers and My Stores refresh. Only the columns that exist; v1 reads the same row and already understands every status
- **Suggestion (strike out if not wanted):** **+** to add a store, `POST /tenants/{tenant}/stores`, the same fields; no migration needed either

**Done (2026-11-07, in #123; the owner asked for + too, and delete):** Store → Store settings: every store with its status; a store's page (name, address, opens, closes, status as a radio list with what each means, latitude, longitude), Save asks first; + adds one. Go: `GET/POST /tenants/{tenant}/store-settings`, `GET/PUT/DELETE …/{storeId}` (reads for guests, writes for admins; `bad_hours`, `blank_name`, latitude and longitude ranges). **Delete without a migration:** a real delete only of a store with nothing recorded (a mistake); the database refuses one with history (no cascade), answered `store_has_history`: make it Inactive. Each write announces `stores` on `tenant:`, so every app reloads /me and its pickers. `TestStoreSettings`.


### 50. Changing language flips back and forth (Both, Now)

**Said:** English to Bahasa switches to Bahasa, back to English, then Bahasa again.

**Done (2026-11-07, in #123):** the screen switched while the cached /me still said the old language; `useMeSync`, re-run by the new locale, saw them disagree and switched back, until the fresh /me switched once more. `LanguageScreen` now writes the new language into the cached /me before switching, so they never disagree.

### 51. Sunday clean-up (Both, 2026-11-08)

**Plan:** [RFC: Sunday clean-up](https://app.notion.com/p/41295a71540581f9b7f2d251dba69f4c), agreed by the owner. PR 1 cut (the API docs out of the backoffice, the store delete endpoint, unused translations and entry points); PR 2 Go quieter (499 for a cancel, no PostHog noise on /me, the worker's fallback poll a minute, staging's clean-up daily); PR 3 the photo cache and two folder moves (`frame/update`, `frame/refresh`, shared views into `views/`); PR 4 the Store page with the owner; then a release and the branches.

**Done (2026-11-08):** PRs #126-#130 released as 2026.11.10; the Store page #133 as 2026.11.11; the evening round #135 (task 062: Store cards as the cash summary, the seller pickers, session badges and confirm, sign-in after Back, Tea-Seller and the Dev names) as 2026.11.12. Branches cleaned. Left open: the iOS keyboard on Google's page (our side cleared), new icons (owner), lykostech.app still says Tea-POS.
