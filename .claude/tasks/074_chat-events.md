# Task 074 — Chat: what chat says by itself

**Status: built 2026-11-21 on `feat/chat-events` (with Step 75; on top of Steps 70 and 76), not pushed. Integration tests pass: each event once in its channel, the jobs twice post once, a payout seen only by the person and VIP, the pay total only in VIP, rain said once each way. Not tried in a browser (staging lacks the tables until merge).**

**Decided while building (owner to check):**
- The payout's transfer screenshot is not in the message: its link opens the payslip, which shows it.
- Rain: a store is open while today's day is not closed; a store with no place yet uses the v1 point's forecast (most have none).
- The pay total adds up the period as its Pay page does: everyone it pays, paid yet or not.
- The release post runs as the worker starts and daily at 09:00, so a missed start catches up.
- The push says the event in the reader's language (`chatevent.Text`, Go's copy of the phone's words).

## The goal

Step 74 of [RFC: Chat (v2)](https://app.notion.com/p/40595a71540581e7b86edc272f66b0c1) (System events): the app's own messages, in each reader's language.

## The plan

1. **One way to post an event** (`api/internal/chatevent`). `Post(ctx, q, tenant, where, type, data)` runs inside the change's own transaction and does the following:
   - makes the channel if it does not exist yet;
   - writes a `system` message with `event_type` and its numbers in `metadata`, never finished text (`body` holds English, kept only as a fallback);
   - moves the channel's last message;
   - announces it and queues the push.
2. **The events** (English and Indonesian examples; numbers made up):

   | Event | Fired by | Channel | Says |
   | --- | --- | --- | --- |
   | `day_summary` | nightly River schedule, 23:30 WIB; reads the database, so stores on v1 get it too; skipped if that day's exists | the store's | 📊 Today: 142 cups · Rp 1.420.000 sales · +12 cups on yesterday · 8% above the 7-day average |
   | `rain_started`, `rain_stopped` | the weather job (Step 76), after each fetch, while the store is open: the chance over this hour and the next two crossing 20% either way, against the channel's last rain message | the store's | 🌧 Rain likely in the next 2 hours (70%) / ☀️ Rain chance down to 10% |
   | `payout_paid` | `settlePayout` (paid) | the person's Notifications; VIP | 💰 Your pay for 17–23 Nov was paid: Rp 1.240.000, with the transfer screenshot / VIP: 💰 Ahmad paid Budi Rp 1.240.000 for 17–23 Nov |
   | `pay_total` | River schedule, 08:00 WIB the morning after a pay period ends (the tenant's pay frequency) | VIP | 💼 Pay for 17–23 Nov: Rp 7.450.000 for 6 people, linking to that period's Pay page (Step 75) |
   | `release` | the worker on start: the newest version in What's new for an app, if General has no message for it yet | General | 🎉 What's new in 2026.11.15 › (a link: opens the What's new page at that version, Step 75) |

   Dropped (owner, 2026-11-21): claim decisions, which are approved in bulk every day. Moved to their own RFC, built just before the sellers move to v2 (owner, 2026-11-21: nobody sells on v2 yet): store opened, expense added, store closed.
3. **Release notes, written at last** (owner, 2026-11-21): `packages/shell/whats-new.json` is still `[]`; no release ever wrote it.
   - A `patch-notes` skill (`.claude/skills/patch-notes`), ported from v1's rules: what a user could notice, one line each, five at most, ordinary words, added, improved or fixed. It writes the release's lines in English and Indonesian.
   - The `release` skill runs it first, as a small PR into `staging` before the release PR.
   - Go learns which versions have notes from a copy that `pnpm --filter @tea-pos/api generate` makes (`api/internal/chatevent/whats-new.json`, embedded); CI fails on a stale copy, as it does for `openapi.yaml`. The page holds the words; chat only links to them.
4. **On the phone** (`packages/chat`): `systemText` gets one line per event in `chat.en` and `chat.id`, with money and times from `@tea-pos/format`, plus a photo where the event has one. A type this build does not know shows `body`.
5. **Tests** (integration):
   - Each event lands once, in the right channel.
   - The nightly and pay-total jobs run twice post once.
   - A payout's message is not visible to another seller.
   - VIP sees `pay_total`; a member does not.

## Done when

- The tests above pass.
- Tried locally:
  - settle a payout;
  - run the schedules and a weather fetch by hand.

  Each message reads right in Indonesian and English.

## Not in this task

Milestones; links that open a screen (Step 75); store opened, expense added, store closed (their own RFC, before the sellers move).
