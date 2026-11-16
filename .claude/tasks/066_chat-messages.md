# Task 066 — Chat: reading and posting

**Status: built 2026-11-15 on `feat/chat-phase-1` (in the PR into staging, 2026-11-16), approved by the owner with the RFC that night.**

## The goal

Phase 1, Step 66 of [RFC: Chat (v2)](https://app.notion.com/p/40595a71540581e7b86edc272f66b0c1): people read and post text, live, with the unread line, Seen by and the count on the app's icon.

## The plan

1. **Go** (`internal/handler/chat.go`): `GET …/channels/{id}/messages` (newest first, cursor pages; `since` for only what is new), `POST …/messages` (`.Idempotent()`; the key is stored as `client_key`, so a repeat never posts twice; read-only channels refused; about 30 a minute per person), `POST …/read` (only moves forward; `.Repeatable()`)
2. **Live**: a new message is announced on each member's own `user:` topic (kind `chat`), so the hub needs no change; a read is announced only to the authors whose Seen by changed (kind `chat_read`) and to the reader's other phones
3. **Screens** (`packages/chat`): the channel as RFC screen 2; the message shows at once with a clock, retries by itself for 30 s, then Not sent · Tap to retry or Delete; the New messages line where the reader stopped; Seen by under one's last message, a tap for the names (screen 3); the read mark at most every 5 s and on leaving; a live update fetches only what came after the newest held
4. **Locally**: `scripts/local-db.sh <app>` runs the app and Go on a copy of staging with the chat migration applied (staging only read)
5. **Tests**: post, the same key twice, paging and since, unread and read, Seen by, read only, someone else's channel

## Done when

- Lint, typecheck, unit and integration tests pass locally
- The owner posts and reads in both apps on `scripts/local-db.sh`

## Not in this task

Photos (067), push (068), replies, reactions, edit and delete (069). The phone's saved cache keeps every message held for now; trimming it to 50 a channel waits for Step 71.
