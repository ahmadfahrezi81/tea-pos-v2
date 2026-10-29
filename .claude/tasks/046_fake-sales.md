# Task 046 — Fake sales on staging, and the 500 KB limits

**Status: merged 2026-10-28 (PR #50); first run on staging found two fixes (PR #52): the script sets `ENV=staging` (Infisical has no `ENV`), and demo stores count too.**

## The goal

Staging's backoffice has something to show: today's sales in the stores the owner opened. And no step stops to trim while v1 runs.
RFC: [Backoffice v2 refinement](https://app.notion.com/p/40595a7154058188873dd594ee4b7875), Step 46; [Releasing](https://app.notion.com/p/40695a71540581c9861ac295d7ca822d), Bundle limits.

## The plan

1. **`api/tools/fakesales`** (`pnpm --filter @tea-pos/api fake-sales`): for every store open today, demo stores included (an active session on today's open day), adds orders by the seller on shift, between the shift's start and now, the way v1's `createOrder` writes them: the order, its items at the product's price, the day's totals (sales, orders, cups; expected cash for cash orders only). One transaction per store
   - Tops each store up to `-orders` (40), so running it twice adds nothing; `-tenant <slug>` for one tenant
   - Closed stores are listed and skipped; nothing else is created (no sessions, stores, products or people), and no activity log lines
   - Refuses unless `ENV=staging`. Under `api/tools/`, outside `cmd/`, so it never ships in the image
2. **Limits:** `scripts/bundle-size.mjs` 500 KB for both apps; `CLAUDE.md` says so until the migration is done

## Owner's part

- Open the stores you want in v1's staging seller app, then run `pnpm --filter @tea-pos/api fake-sales`

## Done when

- A second run prints 0 added for every store
- The Store list and analytics on staging show today's sales

## Not in this task

- Bringing the limits back down (Step 51b, after the migration)
