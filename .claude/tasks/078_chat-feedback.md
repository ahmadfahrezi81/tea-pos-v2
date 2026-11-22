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
   - Decided (owner): **for everyone**, **the owner only**, after a confirmation ("Clear this chat for everyone?").

3. **A shared screen is the screen itself** (owner): what a screenshot of that part of the screen would show, except we own the component. The same components and content as the real screen, live, only a little smaller for the chat's padding, and **as wide as the chat allows** (not inside a narrow bubble); an **Open** button at its bottom to go deeper. For a store's day, a pay period and a payslip, and the app's own messages that carry one (the day summary, the pay total, a payout paid).
4. **Weather shows its proof** (owner): a rain message shows the coming hours as the weather screen draws them (hour, icon, chance), with a sentence summing it up ("Rain likely from 14:00 to 16:00, most at 15:00, 80%"), not only "Rain likely in the next 2 hours".
5. **A release shows its notes** (owner): the release message lists that version's What's new lines in the chat, as bullet points, not only a link.
6. **What's new without the highlight** (owner: "ugly"): opening it from chat goes to the page at that version, with no ring around it.

7. **System looks like the system** (owner, decided): its photo becomes Lucide's `BotMessageSquare` (a robot as a chat bubble; Lucide's `Bot` did not read as a robot), its name stays **System** (Sistem), and a small **BOT** badge beside the name, as Slack's APP, so it is never taken for a person. Everywhere it shows: the chat, Activity, a reply's quote.

**How we work from here (owner):** every event or chat card is drawn in ASCII first and agreed before it is built.

## Done when

- Each item above is fixed, or moved to a later step with the owner's OK.

## Not in this task

Step 71 (the sellers' move) and the store events RFC. An AI agent in chat (its own RFC later): it will reuse System's BOT badge, so the badge is a small component any non-person author can use.
