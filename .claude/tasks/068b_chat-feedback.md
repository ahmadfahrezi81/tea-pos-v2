# Task 068b — Feedback: Chat phase 1

**Status: open 2026-11-16. The owner tests `feat/chat-phase-1` locally (`scripts/local-db.sh`); each item is written here as said, then built one by one. No push, no PR until the owner says so.**

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
