# Task 063 — Small UI updates, new icons, tea-pos becomes tea-seller

**Status: done 2026-11-15: #138, released in 2026.11.13. The address rename (3) postponed.**

## The goal
Three pieces the owner wants together after the clean-up (2026-11-15): a few small UI updates, the new app icons the owner is designing, and the seller app's address renamed from tea-pos to tea-seller, to match its name (Tea-Seller since #135).

## The plan

### 1. Small UI updates
Details to come from the owner, one at a time, an ASCII sketch first where the layout changes. Quick rounds, one commit at the end.

### 2. New icons (done 2026-11-15, not committed)
**Brief (owner, 2026-11-15):** flat, no 3D; a very slight, light gradient on the background only; simple: one mark, no text, nothing busy; reads on cheap dim screens (white on the brand colour, thick shapes). **Tea-Seller:** the tea leaf stays. **Tea-Office:** an office building (owner). **A family:** more apps will come, so every icon follows the same rules: the same light gradient in the app's own colour, one white glyph of the same weight, corner rounding and size in the safe circle; each app only changes its glyph and its colour (Seller a leaf, Office a building; later ones the same way). Designed here as a design canvas (Claude Design is in Claude Code now), then exported. Then:
- Both apps' `public/icons/icon-192x192.png` and `icon-512x512.png` (the manifest, iOS's home-screen icon, the tab icon); the seller's sign-in logo (`/LEMONI-512x512.png` in `apps/seller/app.config.ts`) if it changes too
- A maskable version with its safe margin, so Android does not crop it
- Staging's icon stays the same as production's (owner, 2026-11-08); only the name says Dev
- An installed app keeps its old icon until reinstalled (iOS never updates it)

### 3. tea-pos becomes tea-seller (the address) — postponed (owner, 2026-11-15: too many settings to change for now; the address stays tea-pos)
Today: production `tea-pos.lykostech.app`, staging `tea-pos-staging.lykostech.app`, Cloudflare Pages project `tea-pos`. Go reads the app's address from the forwarder, so Go needs no change.
- **In the repo:** `apps/seller/wrangler.toml` (`name`), `.github/workflows/pages.yml` and `deploy-run.yml` (the project name, the links in the deploy comments), `pr.yml` (the benchmark's address), `api/tests/e2e/e2e_test.go` (`E2E_SELLER_URL`), the test addresses in `telemetry_test.go` (cosmetic), CLAUDE.md where it names the project
- **The old address keeps working** for a while: a redirect from `tea-pos.lykostech.app` to `tea-seller.lykostech.app` (and staging's), so a saved link or an installed app lands somewhere
- **What people notice:** a new address is a new site to the phone, so everyone signs in again once, and the installed app must be reinstalled from the new address (the old one would only redirect). Only the owner uses the v2 seller app until January, so now is the cheapest moment
- **The lykostech.app site** (`../lykostech-site`): Tea-POS becomes Tea-Seller, links to the new address

## Owner's part
- **Cloudflare:** a new Pages project `tea-seller` (or rename `tea-pos`, if Cloudflare allows), its custom domains `tea-seller.lykostech.app` and `tea-seller-staging.lykostech.app`, the same environment variables and secrets as `tea-pos`; a redirect rule from the old addresses
- **Supabase:** Auth → URL Configuration: add the new addresses to the redirect URLs (sign-in fails without it); remove the old ones once nothing uses them
- **Google Cloud** (OAuth consent screen): add the new domain if it lists authorised domains
- **GitHub:** any secret or variable naming the old project
- **PostHog:** nothing needed (events carry the app's id, not its address)
- Reinstall the seller app from the new address

## Open questions
- Keep the old address redirecting for how long? Suggestion: until v1 retires (January)
- Rename the Pages project in place, or a new project? Depends on what Cloudflare allows; a new one keeps the old running until the switch

## Done when
- The seller app opens and signs in at `tea-seller.lykostech.app` and `tea-seller-staging.lykostech.app`; the old addresses redirect
- CI's deploy comments, the benchmark and e2e use the new address and pass
- Both apps show the new icons after a reinstall
- The owner has checked the small UI updates on staging

## Not in this task
The backoffice's address (tea-office stays). Chat.

## Log (small updates, in the order asked)

### A. The Store page's totals panel (backoffice), done 2026-11-15, not committed
`apps/backoffice/src/store/RangePanel.tsx`; `formatCount` in `@tea-pos/format`.
- Its figures under the chart sit in a grey box like the chart's; plain values, semibold, no colours, no heading (owner tried pills, colours and a "Summary" heading: no)
- **One day:** Total cups, Total orders, Busiest hour (the hour only), Expenses, Cups per store (over the stores that opened; several stores only)
- **A range:** Total cups, Total orders, Cups/day, Best day, Slowest day (the quietest day that sold), Cups per store a day (over every day a store opened), Expenses
- **One store's page:** its Status and Seller stay last
- **Units:** every count says what it counts, with money's thousands mark ("6.203 cups", "8 Nov · 413 cups")
- Words: `store.ordersTotal`, `busiestHour`, `cupsPerStore`, `slowestDay`, `cupsPerStoreDay`

### B. One picker for the store and the date, shared by both apps (built in both apps 2026-11-15, not committed)
Today the date picker card (`PickerButton`, "Today ⌄ · Sun 15 Nov · Week 46", the calendar button) and the store picker are separate: the seller picks the store in the header's title ("Orders Pagelaran ⇕"), the backoffice in its store list or a store's page title ("← Laladon Indah"). One component that picks both, in `packages/ui` (or `shell`), used by the backoffice's Store screens and the seller's Orders and Analytics.
- A sketch first: one card with the store and the day (or range, or month) together, each tapping to its own sheet, or one sheet with both
- Each app keeps its own rules: the seller one store (`stores: "one"`) and this month and the two before; the backoffice All stores or one, any range
- To decide with the sketch: does the header's store picker stay (it is the seller's whole-app store, POS included), or does this card take it over on Orders and Analytics only

### C. POS gate: the holder's cups, as v1 (done 2026-11-15, not committed)
The "Session already taken by" card shows the seller holding the day with their cups that day beside the name ("Imel Clarissa · 115 cups"), as v1's `TakeOverCard.tsx` does (`../tea-pos/apps/seller/app/[tenantSlug]/mobile/home/_components/TakeOverCard.tsx`, the cups from the day's users). Check whether v2's gate (`apps/seller/src/home/StoreGate.tsx`, `/stores/{id}/gate`) already carries them; if not, Go adds the holder's cups to the gate's answer.

### D. POS gate cards fill the free height, as v1 (done 2026-11-15, not committed)
The gate's card (taken, closed, not opened) stretches to the bottom of the screen above the tabs, as in v1, instead of sitting short with empty space under it. v1's way (`../tea-pos/apps/seller/app/[tenantSlug]/mobile/home/layout.tsx`): the page `min-h-full flex flex-col`, the gate's wrapper `flex-1 flex` with no `min-h-0` (so a card taller than the screen still grows and scrolls, as with the keyboard open), the card `min-h-full` with its content centred. Check v2's shell gives the page a definite height to fill.

### E. Pay's payout cards press like the store cards (done 2026-11-15, not committed)
A payout card in a pay period pressed with a grey flash; now the same small shrink as the Store cards (`active:scale-[0.99]`). `apps/backoffice/src/pay/Period.tsx`

### F. A store's day: Activity on the store page (done 2026-11-15, not committed)
One store on one day (a day that exists): an Activity row under Orders and Details, to the day's activity the backoffice already has (`…/analytics/days/{id}/activity`), as the seller's day menu offers it. Not on a range or All stores (owner: one day only). `apps/backoffice/src/store/StorePage.tsx`
- **Built, option A (owner: start with A, adjust on the go):** the header shows only the page's title (the seller's store picker beside it is gone, `StorePicker.tsx` deleted). `StoreLabel` (`@tea-pos/shell/StoreLabel`): a pin and the store's name; a chevron and the store sheet only with more than one store. POS: the store label on top, then "Good afternoon · Week 46 · Sun 15 Nov", the POS/Manage switch beside. Orders and Analytics: one card, the store label above the date picker behind a line (`PickerButton`'s `top`). The store picked is still the app's store, POS included
- **Backoffice, next:** the Store screens take their store from the address, so its row there opens a store sheet that changes the address (All stores on the Store home)
- **Store row like the date row (owner: the store's row was small and ugly next to the date's):** `PickerRow` in `@tea-pos/ui/PickerButton`, one row style for both: the name large with a chevron (only when there is a choice), its opening hours under it, a store icon in the same tinted box as the calendar; the whole row taps. `StoreLabel row`
- **One card, one sheet, nested (owner: no store chips, messy with many stores):** the card is the date row again, the store on its second line ("Pagelaran · Sun 15 Nov · Week 46"). With two stores or more, the sheet opens on a menu, "Store and date": Store › (the stores, a radio mark; a pick goes back to the menu) and Date or Month › (the calendar or the months; a pick applies and closes). One store: straight to the calendar or months as before. `DateRangeSheet`'s `store` (`StoreChoice`), `useStoreChoice` in `@tea-pos/shell/StoreLabel`
- **The store and the date on one line (owner: two stacked lines looked bad):** "Pagelaran · Thu 12 Nov ⌄", both a little smaller than before (19 px) but still the heading; a long store name shortens first; the week or the days under it. `PickerButton`'s `heading`
- **The store's name in the brand colour**, as the old header picker had it (seller blue, backoffice orange): the picker card's heading and the POS store label
- **POS front page: the POS and Manage switch full width on its own line** under the store and the greeting, so the greeting line has the width to itself. `HomeHeader.tsx`
- **POS front page: the store in a white card like the picker's:** the name large in the brand colour (a chevron with more than one store), "Good Afternoon · Week 46 · Sun 15 Nov" under it, the store icon in the tinted box on the right; the switch under the card. `StoreLabel row` with `detail`, `PickerRow`'s `brand`

### G. Owner: see past the POS gate (built 2026-11-15: look only, not committed)
The owner wants a switch to look past the POS gate (taken, closed, not opened) to see and check the screens behind it. Options:
- **Look only (suggested):** the owner, and only the owner, gets a switch on the gate ("Look anyway"); the POS shows behind it, but Go still refuses the owner's writes there (an order in someone else's session would go to the wrong person's cups and commission, and into the day's cash)
- **Full bypass on staging only:** the same switch also lets the owner sell, but only where `testlogin`-like staging config allows, never production
- **Built, look only (owner's pick):** the owner, only the owner, gets "Look anyway (owner)" under the gate's card (taken, closed, not opened; not on a day with nobody on it, where the owner can simply open the store). POS and Manage then show behind an amber "Look only: nothing here is saved" banner with a × back to the gate; one switch for both, this tab only, off on reload. Go already refuses every write there (`session_taken`, `day_closed`, `store_not_open`): no Go change. `apps/seller/src/home/lookOnly.tsx`, `Gated` in `StoreGate.tsx`
- **POS front page's line:** "Good Afternoon · Week 46", no date (owner)
- **The owner sees the session code** while looking (owner's ask): Go's gate gives the holder's code to the tenant's owner too (`auth.Caller.Owner`, set with the tenant check; `storeGate` in `seller.go`). No integration test yet (local Postgres too old to run them; add one: the owner's gate carries the code, another seller's does not)
- **The day's hours bar on Manage only**, not on the POS (owner). `HomeHeader.tsx`
- **C built:** Go's gate carries `sellerCups`, the holder's cups that day over all their sessions (`SellerDayCups` in `seller.sql`); the "taken by" chip shows them in an orange pill beside the name ("Imel Clarissa · 115 cups")
- **D built:** `Gated`: the gate's wrapper `flex-1 flex` (no `min-h-0`), so the card stretches to the tabs and still grows and scrolls when taller; the shell's scroller is `absolute inset-0`, so the page's `min-h-full` has a height to fill
- **The POS and Manage switch only past the gate:** shown when the day is the caller's, or the owner is looking; everyone else sees the store card and the gate alone. `HomeHeader.tsx`
- **The hours bar only past the gate too** (it stayed on Manage after the owner closed the look). `HomeHeader.tsx`
- **POS and Manage spacing:** the big gap under the store card came from the header's own bottom padding on top of the page's gap; now one gap of 12 px everywhere (`gap-3`, as Orders and Analytics)
- **The store's name on the POS card the size it has on the picker card** (19 px), not larger
- **Closing the look on Manage goes back to POS** (Manage is no screen of its own at the gate)
- **Backoffice built:** every Store screen's card (`RangeBar`) has the store as its heading ("Pagelaran · Today", "All stores · Last 7 days") and the sheet's Store and Date menu: All stores, then each store. The store is in the address, so a pick goes to the same screen of the other store, dates kept (the Store home to a store's page; a store's page back to the Store home for All stores). `range.tsx`
- **Cleaned up** what the tries left: `PickerButton`'s `top`, `StoreLabel`'s inline variants (only the card row is left), the header's `beside` slot
- **Tests:** `TestGateOwnerAndCups` (the holder's cups for everyone; the code for the holder and the owner, not another admin). Not run here (local Postgres older than 17): CI runs it

### H. The new icons (done 2026-11-15, not committed)
Designed with the owner on a design canvas (rounds: line glyphs, then filled to the owner's references). Tea-Seller: a filled tea leaf, its vein cut out, a short stem, on blue; Tea-Office: one building, a tower with a lower wing, windows and a door cut out, on orange; both flat with a very light top-to-bottom gradient. Each glyph is fitted by `docs/icons/build.py`: as large as it goes with its farthest point 380 px from the centre (Android's safe circle is 410) or 640 px long. **The family rules** for later apps: `docs/icons/README.md`. Exported to both apps' `public/icons/icon-192x192.png` and `icon-512x512.png` (also the maskable and iPhone icon). The seller's sign-in logo is its app icon now (`/icons/icon-192x192.png`, as the backoffice's); `LEMONI-512x512.png`, the old leaf, deleted (owner, 2026-11-15)
