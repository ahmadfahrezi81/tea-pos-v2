# Task 068b — Feedback: Chat phase 1

**Status: done on staging 2026-11-16: items 1-23 in PR #145; item 24 (the keyboard) became the keyboard RFC, tasks 072 and 073. Polish continues in task 068c.**

## The goal

The owner's feedback on chat's screens (tasks 065-068), before the branch goes to staging.

## The items

### 1. Chats tab shows for everyone, locked without access (Both, done)

**Said:** show Chats as before; without a chat level, the same look as "coming soon" (icon in a circle) but saying you don't have access.

**Done:** the tab always shows; `NoAccess` in `packages/chat/ChatsScreen.tsx` is the coming-soon card with a lock: "You don't have access to chat" / "Ask the office to turn chat on for you".

### 2. Channel icons: no tinted background, plain black (Both, done)

**Said:** the list's channel icons (General, Admin, Notifications, #store) don't need the tinted circle behind them, nor the app's colour: chat is its own app, so plain black, the same in seller and backoffice.

**Done:** `packages/chat/ChatsScreen.tsx` `ChannelRow`: no background, `text-gray-900`.

### 3. Chat's own primary colour (Both, done)

**Said:** chat is its own app, so it gets its own theme colour (Slack purple, WhatsApp green; either is fine).

**Done:** violet (Tailwind's violet-600): distinct from seller's blue and backoffice's orange, and green already means money (sales totals). `.chat` in `packages/ui/styles/globals.css` sets `--accent-primary`; both chat screens are wrapped in it, so the bubbles, send and camera follow. The Chats tab in the footer keeps the app's colour.

### 4. The phone column: 430 px, not 480 (Both, done)

**Said:** 480 px is not really a phone size; too wide on a monitor.

**Done:** `--app-max-width` 430 px (the biggest iPhone; most Androids are 360-412), in `packages/ui/styles/globals.css`; the Drawer and toasts follow it instead of their own numbers. Phones are unchanged (narrower than the column).

### 5. A thread looks broken (Both, done)

**Said:** the General thread, two people, looks very broken.

**Done:** `packages/chat/ChannelScreen.tsx`: the message box could shrink to half height after sending (now `min-h-10`, its height cleared after a send); someone else's message had its avatar down by the time, apart from the name: now avatar at the top beside the name, the bubble under it (tail top-left), the time under the bubble, one column like your own messages.

### 6. The message box, redesigned; a plus instead of the camera (Both, done)

**Said:** the composer looks broken; redesign it; a plus button that opens a bottom sheet instead of the camera.

**Done:** `Composer` in `packages/chat/ChannelScreen.tsx`: one row, all 40 px tall so they line up: a grey round plus, the box (rounded pill, 40 px, grows to about five lines), and send (violet circle) only once there is something to send. The plus opens a sheet: Camera (opens the camera) and Gallery (up to 4 photos).

### 7. The two apps' message boxes differ (Both, done)

**Said:** both don't look the same.

**Done:** the cause of items 5-7: Tailwind never scanned `packages/chat` (only `ui` and `shell`), so any class used only by chat was missing, differently per app. `@source "../../chat/**/*.{ts,tsx}"` in `packages/ui/styles/globals.css`.

### 8. The message box as Slack's (Both, done)

**Said:** better, but Slack's design: once tapped, the + (and emoji, @) sit under the box, send at the bottom right; icons only, no circles.

**Done:** closed: a plain + and the grey pill. Tapped (or with text or photos): the box full width, under it the + on the left and the send arrow on the right (violet, grey until there is something to send); no circles. Emoji and @ are not added: the phone's keyboard has emoji, and @ needs mentions, not in the RFC yet (a Phase 2 suggestion).

### 9. The message box: rounded top corners (Both, done)

**Said:** round the top corners a bit.

**Done:** `rounded-t-xl` (12 px; 16 was too much), with the page's bottom colour (`slate-200`) behind the corners, since the shell's footer is white; the top line dropped.

### 10. The box white, "Message General", a grey + (Both, done)

**Said:** the message box should not be grey: white like Slack, the whole thing, and say "Message <someone>"; the + on the left with a grey background.

**Done:** the box has no fill (white, as the bar); its hint names the channel: "Message General", "Kirim pesan ke Fake Store 1" (`chat.messageTo`); the + is a 36 px grey circle, closed and open.

### 11. Not live locally (Both, done)

**Said:** is it not real time yet?

**Done:** chat was live; the local script was not: it ran no hub, so the apps' socket had nothing to reach. `scripts/local-db.sh` now runs `cmd/realtime` on the local database too (port 8091) and points Vite at it (`REALTIME_ORIGIN`).

### 12. One bubble, the time inside (Both, done)

**Said:** as WhatsApp: everything under one background, the time too. Asked whether bubbles suit replies: kept, since the RFC's replies are flat, inline quotes (WhatsApp's), not Slack threads; better for the sellers.

**Done:** a message is one bubble: the name (violet, others' only), photos, the text, and the time on the last line's right; mine add ✓✓ once seen, "Seen by N" under my last one.

### 13. An empty channel as every empty screen (Both, done)

**Said:** no content is shown as the apps do: an icon in a circle, a title, a small line under it.

**Done:** `EmptyState` in an empty channel: "No messages yet" / "Say hi to start the conversation"; Notifications: a bell, "Updates for you will show up here".

### 14. A channel's info, from its header (Both, done)

**Said:** as WhatsApp and Slack: tap a channel's header for its details: icon, name, who is in it. No Leave, and no notification setting: chat is the company's, not a choice.

**Plan:** the header title taps through to `/chats/<channel>/info` (RFC screen 5, without its notification choices): the channel's icon in a circle, its name and one line on who is in it (everyone, this store's people, chat admins, only you), then Members with their photos. Notifications (yours alone) shows no members. Nothing new in Go: `GET /chat/channels/{id}` already returns the members. Everyone stays on all notifications; the RFC's per-channel levels are left out of the screens. A VIP badge on chat admins waits: members carry no level yet (Go).

### 15. Activity beside Messages (Both, done: the screen; its content with Step 69)

**Said:** chat needs a list of notifications, not only messages, as Slack's Activity: its own page, each item opening where it happened. The Chats tab split by the same switch as seller's POS / Manage (`packages/ui/form/Segmented.tsx`): Messages on the left, Activity on the right.

**Decided:** the switch now (seller's POS / Manage look, `Segmented` size `lg`), kept in the address (`?view=activity`). Activity shows an empty state until Step 69 fills it (replies to me, mentions, reactions, the Notifications inbox's items); the Notifications channel leaves the Messages list (nothing writes to it before the system-events RFC).

### 16. A search bar on Chats (Both, done)

**Said:** one big search bar at the top of Chats, the same as UAC's People (`SearchBox`), without the filter button.

**Decided:** channel names, on the phone (`?q=`), no Go. Message search stays under the RFC's Later.

**Changed (owner, after trying it):** the header is WhatsApp's and Slack's: the channel's icon, its name, and under it how many are in it ("3 members"; Notifications: "Only you"; names were tried first, the owner chose the count); a tap opens the info as a sheet, not a page (lighter, and it stays in the channel).

**Built (14-16):** `ChannelHeader` and `ChannelInfo` (a sheet) in `packages/chat/ChannelInfo.tsx`; `HeaderTitle` takes any content and an `onClick`; the Chats tab: `SearchBox` (`?q=`), then `Segmented size="lg"` (Messages / Activity, `?view=activity`), Activity an empty state; Notifications left out of Messages.

### 17. Typing indicator (Both, done)

**Said:** there is no typing indicator. The RFC parked it until someone missed it.

**Done:** `POST /chat/channels/{id}/typing` (members only, refused where nobody posts, at most every 3 s, more dropped quietly): Go announces `chat_typing` with who (`Event.By`) on each other member's topic, nothing stored. An endpoint, not the socket as the RFC drew it: it reuses the access check, the limit and the permission test, and the hub stays a deliverer. The phone (`packages/chat/typing.ts`, `onLive` in `live.ts`) shows "Budi is typing…" just above the message box (as Slack: always in sight, the messages never move; first built under the messages), as a banner like the connection's (soft violet, centred), no dots: a small pencil that writes (`animate-write` in `motion.css`, transform only, still for reduced motion), the banner fading in, its violet carried behind the box's rounded corners for 5 s, gone when their message lands, its own component so the list does not re-render; the Chats list shows "typing…" in violet. Integration test `TestChatTyping`.

### 18. Channel icons in a rounded square (Both, done)

**Said:** the header's icon not a full circle, a rounded square; and the Chats list's icons need their background back, the same rounded square.

**Done:** grey rounded squares (`rounded-xl`, the sheet's big one `rounded-2xl`), the icon black: item 2's "no background" now means no tint, not no shape.

### 19. The unread count as a flat pill (Both, done)

**Said:** not a circle: elongated and flat, as Slack and WhatsApp.

**Done:** at least 28 px wide, 20 px tall, so even "1" is a pill.

### 20. The count up, the time down (Both, taken back)

**Said:** the count top right, by the name; the time on the message's line. Then taken back: with nothing unread the top right was empty and looked awkward.

**Done:** back to the time beside the name and the count beside the message, in item 21's grid.

### 21. The list's text: one grid, readable greys (Both, done)

**Said:** the message is too light a grey on white, the time smaller and darker than it, and the two lines do not line up.

**Done:** a channel row is one grid (name | time, message | count); the message and the time the same colour (`gray-600`, the message near black while unread), the same size (14 px), digits of equal width (`tabular-nums`; mono was tried and dropped: odd on words like "Yesterday", uneven on Android). The shared `ListRow` subtitle (`gray-400`) is unchanged: the owner's to decide for every list.

### 22. A VIP badge on chat admins (Both, done)

**Said:** a badge beside chat admins' names, as Slack's VIP; called VIP (the admins are the family and the owner anyway).

**Done:** `ChatMember.admin` from `ListChatMembers` (the owner, or chat level admin); a small "VIP" (the bubbles' violet, light grey letters) beside their name in the channel's info and on their messages (the name over others' bubbles; the owner looked for it there first).

### 23. Readable greys, every app (Both, done)

**Said:** "Message General" is too light; yes to darkening the search box and every list's second line too.

**Done:** hints (the message box, `SearchBox`) `gray-400` → `gray-500`; `ListRow`'s second line (stores' hours, "Asked 2 days ago", pay types' codes) `gray-400` → `gray-600`, in every list of both apps.

### 24. The keyboard pushes the whole screen up (Both: moved to task 072)

**Said (on staging, phone):** typing a message slides everything up, the header too; in a chat the header stays and only the bottom rises. The search box does not do it.

**Why:** Android already shrinks the page for the keyboard (`interactive-widget=resizes-content`); iOS ignores that and instead pans the whole page to show a field low on the screen. The search box sits at the top, so it never needed panning; the message box sits at the bottom.

**Plan:** in the shell, while the iOS keyboard is open, the app's frame takes the visible area's height and follows it (`visualViewport` height and offset), so the header stays, the messages shrink, and the box sits on the keyboard, as on Android. Keyboard closed: nothing changes. Every screen gets it, so a form's fields behave the same.

**Built:** `packages/shell/frame/useKeyboardViewport.ts` on the shell's frame (`MobileShell.tsx`). Only an iPhone can show it works: tried on staging.

**On staging (PR #146):** it still jumps, then flashes back: correcting the pan after iOS made it cannot be smooth. Redesigned for every field in `.claude/tasks/072_keyboard.md`.
