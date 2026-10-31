# Task 044 — What the seller app keeps, cuts or moves

**Status: list agreed 2026-10-31; building, one big PR, tested locally. Sellers switch only after chat is done.**

The seller app is v1's, minus this list. RFC: Seller v2 (https://app.notion.com/p/40a95a715405810b9d37db50d22c76b3).

## The owner's list

1. **Store picker in the header: keep, copy it over.** The issue: after an admin changes someone's store access it lags, because it reads from a cache. Should be solved by v2's infrastructure (access changes announced live, `/me` refetched); to confirm
2. **Charts: cut the chart pages and the heavy chart library.** No more going to another page for an expanded chart (`orders/chart`, `analytics/chart`), and no expand button. At most, the backoffice's own SVG `AreaChart`, view only, on the screen itself
3. **Location Feedback: sunset, in both apps.** Cut `more/map` and `more/map/add`, and the map library with them. The backoffice already has no such screen, only the unused route `GET /feedbacks`. Keep the tables and their data: maybe useful later, never deleted
4. **At a Glance bar on the home screen: keep if it stays light.** The owner loves it: it shows a seller their day's progress. Measure its cost on the M11 and make it lighter; only if it can't be made cheap, drop it
5. **Product images move to storage we own, and can be edited.** All 12 active products' images are on i.ibb.co.com (one inactive one on Supabase Storage). Move them to our own (Cloudflare R2 suggested), small and cached on the phone, with a way to change a product's image. Keep the POS cards as they are
6. **QRIS: not now.** Never live in production, staging only in v1. Step 30 moves to the future, probably Midtrans rather than Xendit. When it comes, the cart sheet's UI copies v1's one-to-one. The seller app launches cash only
7. **Features hidden behind flags: not in this build.** Reports and requests are hidden in v1 because they only make sense with chat. Later, after the migration. Check v1's list of flags against this
8. **After the migration: a session on the database and on corrections, with its own RFC, in cutover and cleanup.** Why so little soft delete? Why can't an order be edited when a seller makes a mistake? A seller should be able to ask to fix any wrong input, an admin to approve it. Not in this build
9. **A day's menu: no Sessions row, in both apps.** Sessions goes inside the day's Details; the menu keeps Details and Activity. The screen is shared between seller and backoffice
10. **My Claims (reimbursements): keep, with no flag.** Everyone already has it. Add a claim and see their own
11. **Fast Order Mode: sunset.** It helped people while they learned the app; after a year they know it, and v2 is faster anyway. Its setting and its flag go
12. **The UI is v1's, one to one:** the owner has already refined it. Where a component already exists in the shared packages, use that one
13. **Weather Forecast button: cut now.** Rain alerts come through chat, and sellers move only after chat is done

## Step list

The RFC holds the keep, change, cut and later tables. Order: remove `GET /feedbacks`; basics; store sessions; POS and orders; close day and expenses; earnings and claims; analytics and At a Glance; product images last.
