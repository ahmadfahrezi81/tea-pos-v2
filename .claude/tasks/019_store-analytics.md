# Task 019 — Store analytics: the month, its days, the charts

**Status: built 2026-10-24, not committed. Routes: `store/analytics`, `…/charts`, `…/days/<id>`, `…/activity`, `…/sessions`. Endpoints: `days` (a month, with each day's expenses and who worked in two queries, not one request per day as v1), `days/{id}` (photos signed in one Storage call), `…/activity`, `…/sessions`, `sales/products` (by order time, as v1: 3.5% of staging's old orders have no day), `tea-waste`; day of week is worked out on the phone from `sales/days`. Integration test over all of them, another tenant's day refused everywhere. Seen in the browser on staging's Test A data: the month, the charts page, a day's detail. `BarChart` (columns, a target line) and a shared `Sheet` (the store picker uses it now) joined `packages/ui`. Not yet seen: real photos (staging's copied rows point at another Supabase project's files, so they show as missing there) and real activity (Test A has none).**

## The goal

v1 seller's Analytics, one-to-one in look, in the backoffice's Store tab: a month and its days, the charts page, and one day's detail with its activity and sessions, for one store or All stores.
RFC: Build order Step 19 (the routing under the Backoffice heading).

## Where it stands today

- Step 18: the Store tab, its overview, `GET /tenants/{tenant}/sales/days` and `AreaChart`
- v1 (seller, `/mobile/analytics`): a month picker, the month's totals, the mini daily chart, the list of days (closed or not; a tap opens a sheet with Details, Activity, Sessions); `/chart` with five charts; `/daily/[summaryId]` with `/events` and `/sessions`. Its API is seven routes, several reading a whole month of orders page by page in JavaScript

## The plan

1. **Routes:** `store/analytics`, `store/analytics/charts`, `store/analytics/days/<summaryId>`, `…/activity`, `…/sessions` (renamed from v1's `chart`, `daily` and `events`: five charts, a day, what happened)
2. **The month** (`store/analytics`): v1's screen. The list of days from a new `GET /tenants/{tenant}/days?month=&storeId=` (each store's day: totals, closed or not, photo and expense counts). With All stores, each day lists its stores under the date
3. **The charts page**, each chart from the fewest endpoints, summed in Postgres instead of walking orders in JavaScript:
   - **Daily sales** and **monthly**: Step 18's `sales/days`, as is
   - **Day of week:** worked out on the phone from the same days (v1 has a route for it; it is the same rows averaged)
   - **Products:** `GET /tenants/{tenant}/sales/products?from=&to=&storeId=` (one `GROUP BY` over the month's order items)
   - **Tea waste:** `GET /tenants/{tenant}/tea-waste?from=&to=&storeId=` (the closing tea photos' litres per day)
   - **`BarChart`** joins `packages/ui` here (day of week, products), the same look as `AreaChart`
4. **One day** (`days/<summaryId>`): `GET /tenants/{tenant}/days/{id}`: opening balance, sales, expected and actual cash, variance, notes, expenses, the people who sold, and the close-day photos through private signed addresses (017c's `SignRead`, a few minutes each). **Activity:** `GET …/days/{id}/activity`. **Sessions:** `GET …/days/{id}/sessions` (who opened, handovers, now or ended), both as v1 shows them
5. **Access:** ADMIN, in the tenant; a store must be the tenant's. Lists use 017e's paging where they can grow (activity)
6. **Tests:** integration: each endpoint for one store and All stores, against fixture days and orders (totals match the summaries; products add up to 100%; a store of another tenant refused); a private photo comes back only as a signed address

## Owner's part

- Compare each screen with v1's seller Analytics on the same store and month on staging

## Done when

- The month, the charts and a day's detail show the same numbers as v1 for the same store and month, and add up correctly for All stores
- A day's photos open, and their addresses expire
- Each screen draws without a visible wait on the 20× throttled profile

## Not in this task

- Orders: Step 19b
- What the seller app keeps of these screens: Step 34, decided in Step 44
- Editing a day (closing it, fixing cash): the seller's close day, Step 31
