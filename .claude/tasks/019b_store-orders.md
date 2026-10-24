# Task 019b — Store orders: the day's orders and their chart

**Status: built 2026-10-24, not committed. `orders` (a day in WIB, cursor-paged, each order with its items) and `sales/hours` (cups and orders per hour, the day's totals); integration test: 23:30 WIB stays on its day, 00:30 is the next, every order once across pages, the hours trimmed as v1. Seen in the browser on staging's Test A orders: totals, the hourly chart, the list numbered against the day, and the orders chart. Live refetch is wired (`meta.live: ["order"]`) and starts working with Step 29's POS.**

## The goal

v1 seller's Orders, one-to-one in look, in the backoffice's Store tab: pick a day, see its sales by hour in a small chart, and every order of that day; and the orders chart.
RFC: Build order Step 19b (the routing under the Backoffice heading).

## Where it stands today

- Steps 18 and 19: the Store tab, its endpoints, `AreaChart` and `BarChart`
- v1 (seller, `/mobile/orders`): a date picker (today, yesterday, a date), the day's totals, a mini hourly chart in the centre (tap: `/orders/chart`), the list of orders with their items, seller and time, and a sheet with one order's details

## The plan

1. **Routes:** `store/orders` and `store/orders/chart`
2. **The day's orders:** `GET /tenants/{tenant}/orders?date=&storeId=` with 017e's cursor paging (newest first, a page at a time as the list scrolls), each order with its items, total, seller and time. With All stores, each order names its store
3. **By hour:** `GET /tenants/{tenant}/sales/hours?date=&storeId=` (cups per hour, one `GROUP BY` in Postgres in the store's time zone; the first and last selling hours trimmed as v1 does)
4. **Live:** the orders list and the hourly chart refetch when an order is made (017b: `meta.live: ["order"]`; Step 29's POS announces it). Until Step 29, v1's orders appear on the next open or pull to refresh
5. **The orders chart** (`store/orders/chart`): v1's daily chart, from Step 18's `sales/days`
6. **Access:** ADMIN, in the tenant
7. **Tests:** integration: paging a day of orders returns each once while new ones arrive; hours in WIB (an order at 23:30 WIB stays on its day); one store and All stores

## Owner's part

- Compare with v1's seller Orders on the same store and day on staging

## Done when

- The same orders and hourly numbers as v1 for the same store and day
- A day of a few hundred orders scrolls smoothly on the 20× throttled profile

## Not in this task

- Making orders (the POS): Step 29
