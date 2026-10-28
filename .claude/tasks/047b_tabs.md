# Task 047b — The tabs: Store · Pay · UAC · Chats · More

**Status: built 2026-10-28, not committed; waiting on the owner's review (built ahead of review, at the owner's ask).**

## The goal

The backoffice's tabs are its three cores, then More; the store picker leaves the header.
RFC: [Backoffice v2 refinement](https://app.notion.com/p/40595a7154058188873dd594ee4b7875), The three cores; Step 47b.

## The plan

1. **Tabs** (`apps/backoffice/src/routes/_shell.tsx`): Store (the `Store` icon, replacing the dashboard one), Pay, UAC (`UsersRound`), Chats (still the coming-soon page, kept at the owner's ask), More. Supply goes (not the backoffice's)
2. **`/<tenant>/uac`:** "coming soon" until Step 50; `nav.uac` in both languages, `nav.supply` removed
3. **The store picker** leaves the header and sits at the top of the Store screens (overview, analytics, orders, both charts) until Step 48 puts the store in the path and replaces it with the list

## Done when

- Typecheck, lint, build pass; `/supply` is gone from the backoffice
- The owner checks on staging: four tabs, the picker under the header on Store screens

## Not in this task

- The seller's tabs (unchanged; its Chats placeholder stays)
- The Store list itself (Step 48)
