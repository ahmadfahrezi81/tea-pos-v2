# Task 068 — Chat: push notifications

**Status: built 2026-11-15 on `feat/chat-phase-1` (local only, no push), approved by the owner with the RFC that night. Works once the VAPID keys below are in Infisical.**

## The goal

Phase 1, Step 68 of [RFC: Chat (v2)](https://app.notion.com/p/40595a71540581e7b86edc272f66b0c1): a message reaches a phone that is not open, as one line per channel, and a tap opens it.

## The plan

1. **Migration**: `push_subscriptions` (one row per endpoint), in the not-yet-run chat migration
2. **Go**: `GET /push/key`, `PUT /push/subscription` (upserted on every start), `POST /push/subscription/off`. With each message, in its transaction, a River job `chat_push`: it waits 10 s and is unique per channel in that time, so a burst buzzes once with the latest. The worker sends to members who have not read it, want it (their level) and are not reading right now (a read mark in the last 30 s); 404 or 410 deletes the subscription. Title in the reader's language (Indonesian unless they chose English)
3. **One dependency**: `SherClockHolmes/webpush-go` for the encryption (RFC 8291), with the newest `golang-jwt/jwt/v5` it pulls in; govulncheck clean
4. **Service worker** (`packages/config/sw.ts`): `push` shows it with the channel as its tag (one line that updates, no second buzz); a tap focuses the open app and goes to the chat, or opens it
5. **Phone**: More → Notifications → Chat notifications, the big switch, for anyone with chat; asks permission on the tap; renewed quietly on every start. The status-bar badge `badge-96x96.png` is the app's glyph, white on transparent (`docs/icons/build.py`)
6. **Railway** (`.railway/railway.ts`): `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` declared `preserve()` in api, referenced by the worker
7. **Tests**: one push job per burst; subscribe twice is one row; off removes it

## Owner's part

1. Make a key pair per environment: `cd api && go run ./tools/vapid` (prints both lines)
2. Infisical → `staging` (then `prod`), path `/app`: add `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`. Before this branch merges, or Railway's apply finds them missing
3. Push is tried on staging, not locally: the dev server runs no service worker

## Done when

- On staging, a message from one phone shows as a notification on another that is closed, and a tap opens the chat

## Not in this task

The onboarding checklist on each phone (Step 71).
