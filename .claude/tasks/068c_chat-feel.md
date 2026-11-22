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

## Push, found on the phone (2026-11-17)

Three identical notifications for one "Hi": each message queues a push job (River's once-per-10-s rule did not merge them), and three ran together, each sending the channel's newest message. Slide to reply was tried and dropped (owner: holding is enough on the web).

- **Each message is pushed once:** `chat_channels.last_pushed_message_id` (new, nullable); a job claims the newest message before sending and stops if another job already did. New migration, adds only
- **Pushes at once, not a minute late:** a job waited 10 s to merge a burst, and a waiting job is picked up only by the worker's once-a-minute poll. Now it runs as soon as it is queued (the worker hears the insert); while one waits or runs, the next message joins it, and it loops until nothing new is left
- **Activity as Slack's:** every message from others; the photo with the chat's icon in its corner, "Posted in" / "Replied to you in", the message at the size it has in its chat, in black
- The iPhone shows each push on its own (it ignores the channel's tag); only App Store apps get the face with the app icon in its corner

## Chat VIP (owner, 2026-11-17)

- **Levels: None, Member, VIP, Admin.** VIP is a member with the VIP badge, in the VIP chat (the chat once called Admin: the owner is the only admin, so an admins' chat was empty). Admin keeps deleting anyone's message (and groups, later). Migration widens `user_app_access`'s check; `auth.Levels` offers it; UAC lists it
- **UAC's People list shows each person's chat level** beside Seller and Office (`Chat · VIP`)

## Not in this task

Reactions, editing a sent message, voice notes, mentions, search inside a chat (chat phase 2). Scroll assist inside sheets (task 073's leftovers).

## Phone test (owner, on staging)

Score each 1-5 (5 = feels like WhatsApp), with a note when it is not 5. iPhone first; Android when borrowed.

| # | Try | What should happen | Score | Note |
| --- | --- | --- | --- | --- |
| 1 | Tap your own photo | Only the photo opens; no Seen by | | |
| 2 | Tap a message | Nothing happens | | |
| 3 | Hold a message | It sinks a little and its row lights up; the menu opens (Android vibrates) | | |
| 4 | Menu on your own message | Reply, Copy, Seen by, Delete | | |
| 5 | Menu on someone else's | Reply, Copy (Delete too as a chat admin) | | |
| 6 | Copy | "Copied"; pastes elsewhere | | |
| 7 | Seen by from the menu | The Seen by sheet | | |
| 8 | Delete | Confirm, then "Message deleted"; the other phone sees it too | | |
| 9 | Reply from the menu | "Replying to …" strip over the box, keyboard opens, header still | | |
| 11 | Send the reply | The quote shows in the bubble, even gaps and corners | | |
| 12 | Tap a quote | Scrolls to the original and lights it up | | |
| 13 | ✕ on the reply strip | The strip goes, the keyboard stays | | |
| 14 | Type, then tap + | The keyboard closes and the Camera / Gallery sheet shows | | |
| 15 | Send a photo with no text | The time sits on the photo, 4 px border all round | | |
| 16 | Send while typing | The keyboard stays open | | |
| 17 | Tap the messages while typing | The keyboard closes | | |
| 18 | Open the box in a chat at its newest | The newest stays in view as the keyboard slides up | | |
| 19 | Scroll up in a long chat | The down arrow shows; a new message adds a count instead of pulling you down; tap: back to the newest | | |
| 20 | Scroll through days | The day floats at the top while scrolling, fades a second after | | |
| 21 | Scroll to the top of a long chat | Older messages load by themselves, nothing jumps | | |
| 22 | Open a chat with unread messages | It opens at "New messages", not the bottom | | |
| 23 | Someone replies to you | Activity shows it with a count on the switch; tap: the chat at that message | | |
| 24 | Send with no signal | A red !; tap: Retry or Delete | | |
| 25 | Overall feel | | | |
