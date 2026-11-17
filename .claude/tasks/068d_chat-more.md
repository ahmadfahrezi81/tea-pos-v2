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

## Owner's feedback (2026-11-17, on staging)

1. **The down arrow stops short of the bottom.** Tapping it scrolls down but leaves a gap; scroll up and tap again, still a gap. It should land exactly on the newest message
2. **Closing the keyboard lags about a second.** Sometimes, as the keyboard goes down, the content does not follow it for about a second (the frame grows back late)
3. **Activity shows a photo as the word "Photo".** It should show a small preview of the photo beside the row, as the seller's activity log does
4. **Holding a photo message shows "Photo" at the top of the menu.** It should show the photo itself (WhatsApp shows the held message as it is)
5. **@mentions in my own (purple) bubble are only white bold, too close to the rest of the text.** As Slack: the mention gets a highlight behind it, here the darker purple the reply quote uses, with the white text kept. (The owner also wonders whether chat's purple is too dark overall: to look at once these are done)
6. **The Messages list reads like a list of DMs.** Every row is a group chat, so the line under its name says what kind of group it is: how many members ("2 members"), not the last message. The last message and its time can stay, but less prominent: in a group you open it, or read it in Activity. The look of the rows stays
7. **Notifications do not always come.** The push skips anyone whose read mark moved in the last 30 seconds ("reading it now"), and posting a message moves your own read mark: so for 30 seconds after you write in a chat, replies there do not notify you. The owner: every message notifies, even with the app open. Fix: drop the 30-second rule; skip only the author, someone who has already read it, and someone who turned the channel off
8. **The sender's photo in the notification, with the app icon in its corner.** Android: the sender's photo shows since #156. iPhone: not possible for a web app (iOS shows the app's icon on every web notification; the face-with-app-icon style is only for App Store apps using Apple's messaging notifications). Nothing to build; told the owner again
9. **The notification reads wrong.** Today: the chat's name as the title ("General"), "Ahmad Fahrezi: Hi" as the text, and iOS's own "from Tea-Seller Dev" line. As WhatsApp and Slack: the title is the person ("Ahmad Fahrezi"); the text's first line is the chat ("General", a store's name), its second the message ("📷 Photo" for a photo). A web notification has only a title and a text, so the chat is the text's first line; iOS puts its own "from Tea-POS" line under the title of every web app's notification, which no web app can remove. The app's own messages keep "Notifications" as the title

**Done 2026-11-17** (on `feat/chat-more-2`): 1 the arrow scrolls the area itself to its very end, then makes up anything that grew (checked: gap 0, twice); 3 Activity shows a photo's preview on its row; 4 the hold menu shows the held message's photos and text; 5 a mention sits on a highlight (the quote's darker purple in my bubble); 6 the list shows "N members · last active" under each chat (Go counts them by the members rule), the unread count top right where the time was; 7 the 30-second rule is gone; 9 the title is the person, the text "#General" then the message. **2 (the lag closing the keyboard) not found:** the frame starts growing back the moment the box loses focus; the owner sends a screen recording of it.
10. **Tapping the box jumps.** On focus the bar changes layout (the box goes full width, the + drops under it beside send), so the bar grows and everything above it shifts up at once, on top of the keyboard's own slide. Proposed: one row that never changes shape, as WhatsApp: + on the left, the box, send on the right (grey until there is something to send); the box grows only with its own text
11. **Sending crumples the message.** The bubble shown while sending is drawn differently from the one the server sends back (faded, its time under the bubble, a photo cut square while the sent one keeps its shape), so when one replaces the other the bubble jumps: squashed, then wider. Fix: the sending bubble is drawn exactly as the sent one (same bubble, the time inside it with a small clock, the photo in its own shape from the phone's copy), so the swap is invisible; it rises in gently as it is added. Received photos keep their space before they load (width and height are known)

**Done 2026-11-17:** 10 the bar keeps one shape whether tapped or not: the box, then a tools row always shown (+, @, send) as Slack, the owner keeping the second line for @ and tools to come (checked: 96 px focused and not); the @ button types an @ and opens the names; 11 the sending bubble is drawn as the sent one and rises in; my bubbles always keep room for the clock or ticks (checked: 210×32 sending and sent, the swap unseen). A photo's swap uses the same layout (not tried: the browser here cannot pick a file).
