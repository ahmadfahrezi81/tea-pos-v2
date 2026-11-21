# Task 075 — Chat: sharing, backoffice first

**Status: planned 2026-11-21, waiting on the owner's review. Before chat's production release.**

## The goal

Step 75 of [RFC: Chat (v2)](https://app.notion.com/p/40595a71540581e7b86edc272f66b0c1) (Links between the apps), backoffice only (owner, 2026-11-21): chat reaches production in the backoffice for the family, so a link is shared and opened there. The seller app's views wait for Step 71.

## The plan

1. **What can be shared** (one list, `packages/chat/links.ts` and Go's twin):
   - a store's day (`store_days`): opens `store/$storeId/analytics/days/$dayId`;
   - a payout (`payouts`): opens `pay/$start/$userId`.

   A new kind later is one line in each list.
2. **Posting a link:** `POST /chat/channels/{id}/messages` takes an optional `link { kind, id }`.
   - Go checks the caller can see it (the same rule as the screen's endpoint: backoffice access, and the store for a day), then stores `{ refTable, refId }` in `metadata`. Never a URL.
   - The text is optional.
3. **Reading a link:** `ListChatMessages` resolves each page's links in one batch per kind into what the card shows and where it opens:
   - a day: the store's name, its date and the day's cups;
   - a payout: the person, the period and the total.

   A link the reader may not see comes back as a plain chip with no details.
4. **The share button:** the header of those two backoffice screens gets **Share**.
   - It opens a sheet: my channels (search as in Chats), an optional message, then Send.
   - After sending, a toast says "Shared to #Pagelaran" and offers **Open**.
5. **In a bubble:** a link is a small card (icon, title, one line).
   - In the backoffice a tap opens the screen.
   - In the seller app it is a plain chip until Step 71.
6. **Events from Step 74:** `payout_paid` carries the payout's link, so it opens the payout in the backoffice. A claim decision links to its payout.
7. **Tests** (integration):
   - Posting a link to something the caller cannot see is refused.
   - A reader without access gets the chip, not the details.

## Done when

- The tests above pass.
- Tried locally: share a day and a payout into a chat; tap each in the backoffice; the seller app shows a chip.

## Not in this task

- The seller app's shared views (Step 71).
- Sharing other screens (added when someone wants one).
- A link to a store's live view.
