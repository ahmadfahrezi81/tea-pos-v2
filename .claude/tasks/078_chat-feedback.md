# Task 078 — Chat: feedback after 2026.11.17

**Status: collecting 2026-11-22, the owner's feedback after release 2026.11.17.**

## The goal

Fix what the owner finds using chat in production. One item per line below, built together in one PR into `staging`.

## Feedback

1. **The last message on two lines** (owner, as WhatsApp): on the Chats list, a row's message wraps to two lines before it is cut, instead of one. The row grows, and reads more like a group chat. Same in Other channels.

2. **A chat's info as a full page, with Clear chat** (owner):
   - The info leaves its bottom sheet for its own page (`chats/$channelId/info`), opened by tapping the chat's name, as now, and by a **⋯** button at the top right of every chat.
   - Condensed: the icon, name and who it is for in one short block, then the actions as rows (rename, members, follow, archive, clear), then the members.
   - **Clear chat**: the chat becomes empty. Soft: nothing is deleted from the database; a `cleared_at` on the channel (an additive migration) hides every message before it, and they can be brought back if needed. Asks first ("Clear this chat?").
   - Open questions:
     - For everyone, or only for me (as WhatsApp's Clear chat, which empties it on your phone alone)? Suggested: for everyone, since the owner wants the content gone.
     - Who may clear? Suggested: chat admins only, any chat but someone's Notifications.

## Done when

- Each item above is fixed, or moved to a later step with the owner's OK.

## Not in this task

Step 71 (the sellers' move) and the store events RFC.
