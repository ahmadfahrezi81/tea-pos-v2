# Task 078 — Chat: feedback after 2026.11.17

**Status: items 1–9 built 2026-11-22 on `fix/chat-feedback-078` (owner: "build everything in one PR"); item 10 waits on the owner. Designs as agreed in ASCII. New: `cleared_at` (migration `chat_clear`), `POST …/clear` (owner only), `GET …/media`, per-kind screens on `ChatLink` (day, period, payslip, notes), rain hours with from/to/peak. Go tests pass (but the known `TestSellerCloseDay`), typecheck, lint, both builds; not tried on a phone. The weather card has no Open button: the weather is a sheet in More, not a page. "Since 15 Nov" on the info page is left out: the API does not return when a chat was made.**

## The goal

Fix what the owner finds using chat in production. One item per line below, built together in one PR into `staging`.

## Feedback

1. **The last message on two lines** (owner, as WhatsApp): on the Chats list, a row's message wraps to two lines before it is cut, instead of one. The row grows, and reads more like a group chat. Same in Other channels.

2. **A chat's info as a full page** (owner), opened by tapping the chat's name and by a **⋯** button at the top right of every chat (`chats/$channelId/info`):
   - The top: icon, name, who it is for, "1.234 messages · since 15 Nov".
   - **Photos**: the last ones sent, See all opens a grid.
   - **Shared**: days, pay periods and payslips shared there (a small Go query), See all.
   - **Members**: the first 5, See all opens the full list with search.
   - **The ⋯ menu** holds what changes the chat, each only for who may: Rename and Edit members, Archive (groups, chat admins); Unfollow (a chat admin following a chat they are not in); **Clear chat** (the owner only, for everyone, soft: a `cleared_at` hides what came before, nothing deleted; asks "Clear this chat for everyone?").
   - Left out (owner): Open store page; Follow there (it stays on the Other channels list); Mute (chat is the company's); pinned messages and search in a chat (their own steps later).

3. **A shared screen is the screen itself** (owner): what a screenshot of that part of the screen would show, except we own the component. The same components and content as the real screen, live, only a little smaller for the chat's padding, and **as wide as the chat allows** (not inside a narrow bubble); an **Open** button at its bottom to go deeper. For a store's day, a pay period and a payslip, and the app's own messages that carry one (the day summary, the pay total, a payout paid).
4. **Weather shows its proof** (owner): a rain message shows the coming hours as the weather screen draws them (hour, icon, chance), with a sentence summing it up ("Rain likely from 14:00 to 16:00, most at 15:00, 80%"), not only "Rain likely in the next 2 hours".
5. **A release shows its notes** (owner): the release message lists that version's What's new lines in the chat, as bullet points, not only a link.
6. **What's new without the highlight** (owner: "ugly"): opening it from chat goes to the page at that version, with no ring around it.

7. **System looks like the system** (owner, decided): its photo becomes Lucide's `BotMessageSquare` (a robot as a chat bubble; Lucide's `Bot` did not read as a robot), its name stays **System** (Sistem), and a small **BOT** badge beside the name, as Slack's APP, so it is never taken for a person. Everywhere it shows: the chat, Activity, a reply's quote.

8. **Faces side by side, not overlapping** (owner, as Slack now): on the Chats list the last writers' faces sit next to each other with a thin gap (2 px), no white ring, instead of overlapping.

9. **Store settings: each status its own colour** (owner): Active, Demo and Inactive badges look the same today. Active green, Demo amber, Inactive grey, the darker shade of each for its text.

10. **Notifications in the app's language** (owner, asked while building): in the app, the app's own messages are written on the phone, in the language picked in that app; a notification is written by Go in the account's `preferred_language`, which can differ. Suggested, waiting on the owner: keep the language with each phone's subscription (from the app it turned on in), and write that phone's notifications in it. Not built.

**How we work from here (owner):** every event or chat card is drawn in ASCII first and agreed before it is built.

## Done when

- Each item above is fixed, or moved to a later step with the owner's OK.

## Not in this task

Step 71 (the sellers' move) and the store events RFC. An AI agent in chat (its own RFC later): it will reuse System's BOT badge, so the badge is a small component any non-person author can use.
