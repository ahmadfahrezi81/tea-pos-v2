# Task 048 — Store: the live list and a store's page

**Status: built 2026-10-28, not committed; waiting on the owner's review (built ahead of review, at the owner's ask).**

## The goal

The Store tab opens on every store right now: open or closed, who is selling, today's sales. A store's page shows today and leads to its Analytics and Orders.
RFC: [Backoffice v2 refinement](https://app.notion.com/p/40595a7154058188873dd594ee4b7875), Core 1; Step 48.

## The plan

1. **`GET /tenants/{tenant}/stores/live`** (backoffice guests and admins): per store its open session (since when, the seller's name and photo), when it last closed, today's orders, cups and sales; open first, then by name. One query (`StoresLive`)
2. **A store's page reuses `GET /sales/hours`** (today's totals and cups by hour, one store or all) instead of a new `/stores/{storeId}/today`: the same numbers, already there. Open or closed and the seller come from the list's query, already in the cache
3. **Routes:** `/store` the list; `/store/<storeId>` a store's page; `/store/<storeId>/analytics/…` and `/orders/…` (Steps 19, 19b), moved from `/store/…`. The store is in the address (`useStoreId`), so a link opens exactly that store. `all` is every store together (a row at the bottom of the list), answering the RFC's open question by keeping it
4. **Gone:** Step 18's month overview (`StoreOverview`) and the store picker on Store screens; the picker's files stay in the shell for the seller app
5. **Freshness:** the list refetches every minute while on screen (v1 writes without telling the hub), and on pull
6. **`HeaderTitle`** in the shell: a title from data (the store's name) in place of the route's

## Done when

- Integration test `TestStoresLive` (open first with the seller, today only, cups from items, last closed, a guest may look); typecheck, lint, bundle
- The owner checks on staging after Step 46's fake sales

## Not in this task

- Each store's stock (the RFC's Later)
