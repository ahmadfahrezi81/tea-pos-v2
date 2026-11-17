# Task 068d — Chat: one app's notifications, reactions, mentions, edit

**Status: built 2026-11-17 on `feat/chat-more-2`; Go integration tests pass (reactions, edit, mentions, one app per phone); tried locally (a reaction, an @mention, an edit). The owner tests on staging.**

## The goal

The next part of chat after 068c, from the RFC's phase 2 ([RFC: Chat (v2)](https://app.notion.com/p/40595a71540581e7b86edc272f66b0c1), Step 69), minus groups and Follow (Step 70), which wait until someone needs them.

## The plan

1. **Notifications from the app last used** (owner's idea). Someone with Tea-POS and Tea-Office on one phone got every message twice. A subscription now remembers its app (`push_subscriptions.app`, new, nullable, set from the session that subscribes; every start re-subscribes, so old rows fill in). For each person and phone (`user_agent`), a push goes only to the app they used most recently (`sessions.last_seen_at` for that app). Rows without an app still get it, as today
2. **Reactions**, as the RFC: six fixed (👍 ❤️ 😂 😮 😢 ✅) on top of the hold menu; under the bubble, each emoji with its count, mine highlighted; tap one to add or take back mine; hold a reaction row for who reacted. New table `chat_message_reactions` (message, user, emoji; the primary key is all three). `PUT` / `DELETE /chat/channels/{id}/messages/{message}/reactions/{emoji}`. A reaction does not push and does not change unread; it shows live (the message comes again with the channel's catch-up: `chat_messages.changed_at`). Not in Activity for now
3. **@mentions**: typing `@` in the box shows the channel's members (and `@everyone` for a VIP or admin), filtered as you type; picking one writes `@Name`. In a bubble, a mention of anyone is bold in the brand colour, of me with a light highlight. Stored as text (the RFC: highlighted on the phone only); Go finds `@` + a member's full name to mark Activity "Mentioned you". A mention pushes as any message
4. **Edit your own message** within 15 minutes (the RFC): Edit in the hold menu puts the text back in the box with an "Editing" strip; saving shows "edited" beside the time. `PATCH /chat/channels/{id}/messages/{message}`; `edited_at` exists. An edit never pushes. Photos stay as they were

One PR. Migrations add only: `push_subscriptions.app`, `chat_message_reactions`, `chat_messages.changed_at`.

## Done when

- Integration tests: one push per phone (to the app used last), a reaction added once and taken back, reactions only in channels you are in, edit refused after 15 minutes and for someone else's message, Activity's mentioned rows
- Tried locally in the browser with the fake iPhone keyboard, then the owner's phone test (a checklist added here, scored 1-5)

## Not in this task

Groups, Follow and Other channels (Step 70); sharing a screen into chat; message search.

## Phone test (owner, on staging)

Score each 1-5 (5 = feels like WhatsApp), with a note when it is not 5.

| # | Try | What should happen | Score | Note |
| --- | --- | --- | --- | --- |
| 1 | Both apps installed, notifications on in both; use Tea-Office, then have someone message you | One notification, from Tea-Office; use Tea-POS, then again: from Tea-POS | | |
| 2 | Hold a message, tap ❤️ | The menu closes, ❤️ under the bubble, lit as yours | | |
| 3 | Tap your ❤️ under it | It goes | | |
| 4 | Someone else reacts too | The count shows (2); hold it: who reacted | | |
| 5 | Type @ in the box | The chat's people show; typing narrows them; tap one: `@Name ` in the box | | |
| 6 | Send it | The name is bold in the bubble; the other person sees it lit, and "Mentioned you in" in Activity | | |
| 7 | @everyone (VIP or admin) | Offered at the end of the list | | |
| 8 | Hold your message (under 15 minutes), Edit | "Edit message" strip, the text in the box; send: the bubble changes in place with "edited"; no notification | | |
| 9 | Hold a message older than 15 minutes | No Edit | | |
| 10 | Overall feel | | | |
