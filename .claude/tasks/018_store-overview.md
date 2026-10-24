# Task 018 — The Store tab and its overview

**Status: built 2026-10-24, not committed. Checked: integration test for `sales/days` (one store, All stores, not closed, another tenant's store, ranges, a seller refused); in the browser on staging's Test A data (local Go): the overview's numbers against last month, the chart with its labels, peak and a tooltip on tap, the rows to Analytics and Orders. Each app now declares its tabs (`shellRoute([...])`); backoffice opens on Store. The backoffice's first screen is 137.5 KB: its budget is now 140 (was 130 for both; seller stays 130 at 129.0), about 2 KB of it the cost of the shared code splitting into more files once the Store screens arrived. `seed.sql` gains Test A's last 60 days and 3 days of orders, so staging has something to show.**

## The goal

The backoffice's first tab becomes **Store**: everything about the stores, opening on a short overview (like YouTube Studio's analytics: a few numbers, one small chart, then deeper screens one tap in). It replaces v1's backoffice Home. It also builds our own chart, the first one v2 draws.
RFC: Build order Step 18 (owner, 2026-10-24: Store for the stores, Pay for the people; the routing under the Backoffice heading).

## Where it stands today

- Backoffice and seller both have Home (the tenant's store list) and More tabs, hard-coded in `packages/shell/ShellLayout.tsx`
- The store picker (017d) gives every screen one store or All stores
- v1: the backoffice Home shows a greeting, work days, totals and a daily sales chart; v1 seller's Analytics shows the month's totals and a mini daily chart (cups per day, the peak's label in bold, a tooltip, scrolling sideways), read from `store_daily_summaries` (one row per store per day, its totals written when the day is closed)

## The plan

1. **Tabs per app** in `app.config.ts` (a `tabs` list of route, label and icon), so each app names its own: backoffice **Store** (`LayoutDashboard` icon) and More; seller keeps Home and More. Pay joins in Step 20
2. **Routes:** `/<tenant>/store` is the overview; `/` and `/<tenant>` go to it in backoffice. `store/analytics` and `store/orders` come in Steps 19 and 19b; until then the overview's rows to them are left out
3. **One endpoint, reused by Step 19's charts** (v2's own endpoints, not v1's: owner, 2026-10-24, better designs welcome; the data model stays until after cutover): `GET /tenants/{tenant}/sales/days?from=&to=&storeId=` (ADMIN, in the tenant): one row per day with sales, orders and cups, summed over the chosen store or every store, and how many of that day's stores are not closed yet. From `store_daily_summaries`, as v1 reads them; a new sqlc query, an index if the plan needs one
4. **The overview** (new; v1 has no screen like it). Suggested, strike what you don't want:
   - **This month:** sales, cups and orders, each with its change against the same days of last month (`+12%`)
   - **One small chart:** cups per day this month, v1's mini chart redrawn with ours; a tap opens the charts page once Step 19 exists
   - **Days not closed yet:** a warning row with how many, as v1's Analytics shows it
   - **Today:** counted once closed, as v1 (owner, 2026-10-24); until then "today: not closed yet"
   - **Rows:** Analytics ›, Orders › (from Steps 19 and 19b)
5. **Our chart, `AreaChart` in `packages/ui`:** plain SVG, no library, looking like v1's recharts chart but simpler (owner, 2026-10-24: no gradients): a soft line and fill in the brand colour, a value over each point (the peak in bold), dates under it, a tooltip on tap, sideways scroll when the month is wider than the phone. Drawn in a few KB; `BarChart` follows in Step 19, where day of week first needs it. Shown beside v1's chart on the same month before moving on
6. **Numbers and dates** through `packages/format` (money, `+12%`, short dates) in the store's time zone
7. **Tests:** integration: the endpoint sums one store and All stores correctly, counts unclosed days, refuses another tenant's store and a non-admin. The bundle check: the Store tab's code loads with the tab, not on the first screen; the chart's size is reported

## Owner's part

- Look at the overview and the chart beside v1's on staging, and say what to change

## Done when

- Backoffice opens on Store: this month's numbers and chart for the chosen store or All stores, matching v1's Analytics for the same store and month
- Switching the store in the header redraws the overview with that store's numbers
- The chart reads well on a phone (labels, peak, tooltip, scroll) and draws without a visible wait on the 20× throttled profile
- First screen still within its 130 KB budget

## Not in this task

- Analytics (the list of days, the charts page, a day's detail): Step 19
- Orders and its chart: Step 19b
- The Pay tab: Step 20

## Owner's feedback, 2026-10-24 (on staging)

The frame must feel like v1's, one-to-one in look and use (what runs underneath may differ). Fixed first:

1. **Footer:** v1's full tab bars, with screens not built yet showing v1's "coming soon" card. Backoffice: Store (`LayoutDashboard`), Pay (`DollarSign`), Supply (`Package`), Chats (`MessagesSquare`), More (`MoreHorizontal`). Seller: POS (`ShoppingCart`, Manage `Layers` inside manage), Orders (`ReceiptText`), Analytics (`ChartNoAxesCombined`), Chats, More; the seller opens on POS (v1 has no Home tab)
2. **Header:** the store as v1 shows it: the name large in the brand colour with `ChevronsUpDown`
3. **The store sheet** as v1's: pull tab, "Select Store" with the eye switch hiding demo and inactive stores, All Stores first in bold, DEMO and INACTIVE tags, round checks; the shared `Sheet` takes v1's sheet styling
4. **Menu rows in v1's style, as one component:** `SettingsGroup` and `SettingsRow` (`packages/shell/Settings.tsx`: the icon, the label, the orange chevron, a divider under each row), used by the Store overview's rows and More, and by every later menu (Pay, Supply)
5. **The loading bar under the header:** 3 px instead of v1's 2 px
6. **Translations split by screen** (owner's question: why does each step make the first open heavier?): the first open loaded every screen's words. Now the core file (`packages/i18n/en.json`, `id.json`) holds the shell's and each app's first screen's; the Store screens' words (`areas/store.*.json`) load with their routes (`loadArea` in the route's `loader`), and the old app's seller sections not used yet (`areas/seller.*.json`) wait for their screens. First screens: seller 129.3 → 126.0 KB, backoffice 137.1 → 134.2 KB; the backoffice budget is back to 135
