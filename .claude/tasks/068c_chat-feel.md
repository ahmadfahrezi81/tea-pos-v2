# Task 068c — Chat feels like a chat app

**Status: built 2026-11-17 on `feat/chat-feel`, all items; Go integration tests pass (reply, delete, Activity, permission); lint, typecheck, unit tests pass. Not yet seen on a phone: the owner tries it on staging. No migration: a reply uses the existing `thread_root_id` (the exact message it answers).**

## The goal

Chat phase 1 works (tasks 065-068b, PR #145) and the keyboard holds still on the iPhone (task 073). What is left is the feel: the small things WhatsApp and Slack do that ours does not. RFC: Chat (phase 1 shipped; this is its polish, not phase 2).

## The bugs

- **Tapping my own photo opens it and the Seen by sheet together.** `packages/chat/ChannelScreen.tsx` `Message`: my whole bubble is a button that opens Seen by, so a tap on a photo opens both. Fix: a tap on a bubble does nothing (a photo opens the photo); Seen by moves into the message menu (item 1)
- **The + sheet hides under the keyboard.** Typing, then tapping +: the box keeps its focus (the button stops the blur so send works), the keyboard stays, and the sheet opens under it. Fix in `packages/ui/layout/Drawer.tsx`, for every sheet: opening one closes the keyboard of a field outside it, as WhatsApp's attach sheet replaces the keyboard

## The plan

1. **Hold a message for its menu** (the bug's fix). A long press (about 400 ms, a short vibration on Android) lifts the bubble and shows a menu under it, the rest dimmed:
   - **Reply** (item 2), **Copy** (text only), **Seen by** (my own messages: the sheet that exists today), **Delete** (my own, or anyone's for a chat admin: soft, a "deleted" line stays, as the Chat RFC; `deleted` already exists in the data)
   - The small "Seen by 3" under my last message stays as today and opens the same sheet (suggestion)
   - Not a right-click menu: the browser's own (copy, select text) is turned off on bubbles
2. **Reply to a message.** The box shows the quoted message above it with an ✕; the sent message shows the quote at its top, and tapping the quote scrolls to the original (it flashes). Needs a nullable `reply_to` column on the messages table (new migration, adds only) and the field on send and in the list
3. **Down arrow when scrolled up.** A round button above the box, bottom right, once the newest message is off screen; a count of new messages since you scrolled up; tap scrolls smoothly to the newest. While you are scrolled up, a new message does not pull you down
4. **Open at the first unread.** A chat with unread messages opens at the first of them, under a "New messages" line; with none, at the newest as today
5. **Sticky day labels.** "Today", "Yesterday", or the date stays at the top while scrolling through that day's messages
6. **Older messages without a jump.** Scrolling near the top loads the page before; what you were reading stays exactly where it was
7. **Tap the messages to close the keyboard,** as WhatsApp (a tap on the list blurs the box)
8. **A failed message is plain to see:** a red ! beside the bubble; tap for Retry or Delete (today's outbox buttons, moved into that)
9. **Activity, as Slack's** (owner, 2026-11-17): the second side of the Chats tab (built empty in 068b) lists everything about me across every channel, newest first, without opening them: a reply to my message, my `personal` inbox (payouts, claims), and mentions and reactions once phase 2 adds them. Each row: who, the channel, the text, the time, unread in bold; a tap opens the channel at that message. A count on the switch for unread ones. Go: `GET /chat/activity` (paged), from replies to my messages and my `personal` channel, through the same membership check; read follows each channel's read mark, so nothing new is stored

Steps 1 and 3-8 are the screen only; 2 and 9 are Go and the screen. All in one PR, built in this order: the bugs, 1, 3-8, 2, 9.

## Done when

- Tapping my photo opens only the photo; Seen by is only in the menu and the small link
- Each item tried with the fake keyboards locally, then on the owner's iPhone on staging
- The reply's migration only adds a nullable column; `schema.sql`, sqlc and the contract regenerated; an integration test for a reply to a message in another channel (refused)

## Not in this task

Reactions, editing a sent message, voice notes, mentions, search inside a chat (chat phase 2). Scroll assist inside sheets (task 073's leftovers).
