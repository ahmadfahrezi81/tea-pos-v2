# Task 070 — Chat: groups and the chat admin's view

**Status: planned 2026-11-21, waiting on the owner's review. Before chat's production release.**

## The goal

Step 70 of [RFC: Chat (v2)](https://app.notion.com/p/40595a71540581e7b86edc272f66b0c1): groups made by chat admins, a person's group chats in UAC, and Other channels with Follow for chat admins.

## The plan

1. **Migration** (`supabase migration new chat_groups`, additive only):
   - `chat_channel_members (channel_id, user_id, added_by, added_at)`, primary key `(channel_id, user_id)`, row level security on with no policies.
   - `chat_channels.archived_at timestamptz`: an archived group is read only.
   - `chat_reads.followed_at timestamptz`. **This differs from the RFC**, which made any `chat_reads` row a follow. Opening a channel already writes a read mark, so a row can't mean "following".
2. **Who is in a channel** (`api/db/queries/chat.sql`, `push.sql`): every membership `CASE` gains `WHEN 'group' THEN` a row in `chat_channel_members`.
   - A chat admin may open any channel of the tenant (`GetChatChannel`, posting, reading).
   - A chat admin gets badges and pushes only for channels they are in or follow.
3. **Endpoints** (`auth.App("chat", Admin)` for writes, `.Idempotent()`):
   - `POST /chat/groups` (name, members)
   - `PATCH /chat/groups/{id}` (rename, archive or unarchive)
   - `PUT /chat/groups/{id}/members` (the whole list)
   - `PUT`, `DELETE /chat/channels/{id}/follow` (a chat admin following or not)
   - `GET`, `PUT /uac/users/{userId}/chat-groups` (the person's groups, the same rows)
   - `GET /chat/channels` also returns `other` for chat admins: channels they are not in and do not follow.
4. **Screens** (`packages/chat`):
   - Chats gets a **New group** button for chat admins (screen `/chats/new`: name, then members picked from the tenant's chat users).
   - Under the list, an **Other channels** section with **Follow**.
   - A group's info gets Rename, Members (add, remove), and Archive. An archived group shows "Archived" and has no message bar.
   - A followed channel's info shows **Unfollow**.
5. **UAC** (backoffice): a person's page gets a **Group chats** row beside Stores, opening a list of groups with checkboxes (`uac/$userId/group-chats.tsx`).
6. **Tests** (integration):
   - Only group members, followers and chat admins can read a group.
   - A member removed from a group is out.
   - Nobody can post in an archived group.
   - Follow changes badges and pushes, not access.
   - Only chat admins can write groups.

## Done when

- The integration tests above pass.
- Tried locally: make a group, add someone, post, rename, archive; follow a store chat as an admin.

## Not in this task

Members making their own groups (RFC: not at first); the windowed list and checklist (Step 71).
