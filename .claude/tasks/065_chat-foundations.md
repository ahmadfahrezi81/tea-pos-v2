# Task 065 — Chat: the tables, chat access, the Chats tab

**Status: done on staging 2026-11-16, PR #145; not released yet.**

## The goal

Phase 1, Step 65 of [RFC: Chat (v2)](https://app.notion.com/p/40595a71540581e7b86edc272f66b0c1): chat exists as its own app in the access model, its channels are made on demand, and the Chats tab lists them for anyone with a chat level. Nothing to post yet (066).

## The plan

1. **Migration** (`supabase migration new chat`), additive only:
   - `chat_channels` (kind general | store | admin | personal; group comes in 070), `chat_messages`, `chat_reads`; RLS on, no policies; one unique index per kind so making a channel twice does nothing
   - `user_app_access`'s check widened to allow `chat` `member` / `admin`
2. **Access** (`internal/auth`): `Levels["chat"] = {member, admin}`; a chat route (`auth.App("chat", …)`) is reached from either app's session and checks the chat level, the owner always admin. Chat rows never count as "levels set" or as an app to sign in to, so nobody's seller or backoffice fallback changes
3. **`/me`** and **UAC**: the chat level per tenant; the person page offers Chat: None, Member, Admin, saved with the rest
4. **`GET /tenants/{tenant}/chat/channels`**: the caller's channels, made first if missing (check, then insert only what is missing): General, their stores' (demo included), Admin for chat admins, their Notifications. Each with its name (a store's read live), last message, unread count (stops at 100)
5. **Screens**: a `packages/chat` package; the Chats tab only for someone with a chat level, with the unread count on it; the list as RFC screen 1; "no access yet" as screen 8. Both apps
6. **Tests**: integration tests for access (None refused, member, owner admin), channels made once, store channels following store access, Admin only for admins; the permission test covers the route

## Owner's part

Nothing until it is merged; then give chat levels in UAC.

## Done when

- `pnpm lint`, `pnpm typecheck`, `pnpm test`, the integration tests pass locally
- The owner sees Chats in both apps after giving themselves chat in UAC

## Not in this task

Messages (066), photos (067), push (068), groups and Follow (070).
