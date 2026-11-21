# Task 074 — Chat: what chat says by itself

**Status: planned 2026-11-21, waiting on the owner's review. Before chat's production release.**

## The goal

Step 74 of [RFC: Chat (v2)](https://app.notion.com/p/40595a71540581e7b86edc272f66b0c1) (System events): the app's own messages for every event that can fire today.

## The plan

1. **One way to post an event** (`api/internal/chatevent`). `Post(ctx, q, tenant, where, type, data)`, called inside the change's own transaction, does the following:
   - makes the channel if it does not exist yet (the store's, the person's Notifications, VIP, General);
   - writes a `system` message with `event_type` and its numbers in `metadata` (never finished text; `body` holds English, kept only as a fallback);
   - moves the channel's last message;
   - announces it, and queues the push.

   The push follows the existing rules (everyone but someone who has already read it).
2. **The events:**

   | Event | Fired by | Channel |
   | --- | --- | --- |
   | `payout_paid` | `settlePayout` (paid) | the person's Notifications, and VIP |
   | `claim_approved`, `claim_rejected` | `decideClaim`, `reviewDay` (one message per claim) | the claimant's Notifications |
   | `store_opened`, `store_closed` | `openStore`, `closeStoreDay` (v2 stores only: v1 writes nothing) | the store's |
   | `expense_added` | `createExpense` | the store's |
   | `day_summary` | nightly River schedule, after the last store closes: cups, waste, against yesterday and the last 7 days; skips a store whose summary for that day exists (so a rerun is harmless); reads the database, so it works for stores still on v1 | the store's |
   | `pay_total` | weekly River schedule: what the period just ended pays in all, for the business-account transfer | VIP |
   | `release` | the worker on start: the newest entry of `whats-new.json`, if General has no message for that version yet | General |

   The payout and claim messages carry `{ refTable, refId }`, so Step 75 makes them tappable.
3. **Release notes reach Go:** `pnpm --filter @tea-pos/api generate` copies `packages/shell/whats-new.json` to `api/internal/chatevent/whats-new.json` (embedded); CI fails if the copy is stale, as it does for `openapi.yaml`.
4. **The phone writes each event in its own language** (`packages/chat`): the system-message `systemText` gets one line per event type in `chat.en` and `chat.id` (Indonesian by default), with names, times and money formatted by `@tea-pos/format`. A type this build does not know shows `body`.
5. **Activity:** a message in my Notifications channel already shows there; nothing new.
6. **Tests** (integration):
   - Each event lands once, in the right channel.
   - The nightly job run twice posts once.
   - A payout's message is not visible to another seller (`personal`).
   - VIP sees `pay_total`; a member does not.

## Open questions

- **Schedules' timing**, as proposed:
  - `day_summary` at 23:30 store time in production, by hand on staging;
  - `pay_total` Monday 08:00 for the week before.

  Are these right, or should the pay total follow the tenant's pay frequency?

## Done when

- The tests above pass.
- Tried locally:
  - open and close a demo store's day, add an expense;
  - settle a payout, decide a claim;
  - run both schedules by hand.

  Each message appears in Indonesian and in English.

## Not in this task

- Rain (production's weather job is off until Step 45).
- Milestones.
- Links opening a screen (Step 75).
