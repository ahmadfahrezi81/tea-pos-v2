# Task 077 — Chat: feedback after the release

**Status: items 1–6 built 2026-11-22 on `fix/chat-release-feedback` (owner: "update all, one PR, then release"). Item 6 as suggested (Share in the week's card). Typecheck, lint, both builds, bundle size and the Go tests pass (but the known `TestSellerCloseDay`); not tried on a phone.**

## The goal

Fix what the owner finds once chat is in production. One item per line below, each with what to change; built together in one PR into `staging`.

## Feedback

1. **Samsung M11: Turn on does nothing.** No question pops up, the card stays, no notifications; the phone's settings say notifications are allowed.
   - Production's logs: the M11 never asked for the push key, so it stopped at the phone's permission question. Another of the owner's devices subscribed fine at 16:32.
   - Likely Chrome's "quieter" permission prompt: it shows as a small bell in the address bar, and an installed app has no address bar, so the question is never seen.
   - Fix:
     - Report each step of Turn on (permission's answer, the key, subscribe's error) as an app event, so production says why.
     - When the phone does not say yes, the card says where to allow it (the app's notification settings) instead of nothing.
     - The button never stays stuck.
   - Owner checked: Chrome; the site's settings list only Sound; Account → Notifications says Off; taps since 16:40 never asked for the key. So Chrome's question never comes back "granted".
   - Built: `turnPushOn` waits 15 s at most for the question and throws `PushNotOn` (blocked, notAsked, failed) instead of returning quietly; `useTurnPushOn` (`@tea-pos/shell/push`) reports it and opens a sheet with the steps (Chrome: Site settings → Notifications, quieter messaging off, the site to Allow; iPhone: Settings → Notifications), as v1's camera does. Used by the Chats card and Account → Notifications.
   - Note: nobody is notified of their own messages; try with someone else writing.

2. **Permissions, robust everywhere** (owner: "robust from our end, and in the worst case a backup"). Today only notifications got it (item 1); the camera still fails silently, as v1's did before its task 030 (`PhotoInput` returns quietly on an empty pick).
   - **One way for every permission** (`packages/shell`): for notifications and the camera, check the state first (`navigator.permissions`, with a fallback where it is missing), ask with a time limit, and never fail quietly. A failure is reported with its reason.
   - **One help sheet, shown from anywhere** (as the toast: `showPermissionHelp("camera")` in `packages/ui`, the sheet mounted once by the shell): what happened, the steps for this phone (Android with Chrome, iPhone), and the backup:
     - **Open in Chrome**: the app's own address in a Chrome tab, where Chrome shows its question in the address bar (an installed app has none). Allowing it there allows the app too, since it is the same site.
   - **The camera**: before opening it, a blocked camera opens the sheet; one never asked is asked first (as v1). An empty pick only opens the sheet when the camera is blocked, so cancelling is still quiet.
   - **Account → Permissions** (in place of Notifications): Notifications and Camera, each Allowed, Not asked or Blocked; tapping asks again or opens the sheet. Notifications keeps its switch.

3. **The app's own messages look like a person's** (owner): today they are a grey pill in the middle. Instead, a bubble on the left like anyone's, from **System** (Indonesian: Sistem) with a round icon from lucide as its photo (`Bot`), its text in the bubble and its card (day, pay, release) under it. Same on Activity's rows and in a reply's quote.
4. **Faces under a chat's name** (owner, "as Slack's threads"): on the Chats list, each row's second line shows the faces of the last 3–4 people who wrote there, overlapping, before "2 members · 19 Nov". Go returns them with each channel (the last distinct authors, one read for the whole list).
4b. **A Chats row as WhatsApp's** (owner chose layout B from two drawn): the name and the time (bold brand while unread); the last message ("You: …", "Budi: …", System's own words, Photo) and the unread count; the faces (22 px) and how many are in it. The icon grows to 48 px. Replaces the date beside the members.
5. **How many messages a chat has** (owner: "only if it's worth it"). Suggestion: not on the list, where unread already says what matters, but in a chat's info ("1.234 messages"), counted when the info opens. The owner may strike it out.

6. **One action at the top right of a root page** (owner: Share beside the account photo on the Pay tab looks awkward). The rule for every app: a tab's root page shows one thing at the top right.
   - Suggested: Share leaves the Pay tab's header and becomes a small share icon in the week's card (beside ‹ Week 46 ›), so the header keeps only the account photo. The day and payslip screens are not roots: their Share stays in the header.
   - The owner's other way: on a root page, Share takes the account photo's place. The shell enforces either one (`HeaderActions` on a root route).

7. **The M11's real switch was Chrome's own** (owner, testing production): the app's notification setting leads to Chrome's page for this site, but notifications were off for Chrome as a whole. The help sheet's Android steps now start there: Chrome → Settings → Notifications → Show notifications, then the site's settings.
8. **A tapped notification showed "This site can't be reached" (ERR_FAILED)** while the app opened. With the app open, the worker reloaded its page (`navigate`), and on the M11 that load failed. Now:
   - the worker asks the open app to change screen (`OPEN` message), and the shell's `startApp` listens (it never did, so the old fallback did nothing);
   - a screen the saved copy cannot answer falls back to the network, never the browser's error page.
9. **Faces even before anyone writes** (owner: in production nobody had written, so no faces): who wrote last first, then the other members, up to 4.

10. **Robustness review of items 1–9** (owner: "any device, older Android, iPhone; and a backup where it can't"). Found and fixed:
    - An iPhone asks only within the tap itself: Turn on awaited the service worker first. Now the question comes before any wait.
    - Nothing can hang the button: the worker's readiness (15 s) and subscribing (20 s) have limits, as the question has.
    - A subscription the server did not keep was shown as On: saving now fails loudly, and Turn on says so.
    - A subscription made with another key is never delivered: Turn on and every start make a new one.
    - Every start heals a lost subscription (iPhones drop them) when notifications are allowed, unless the person turned them off in Account (remembered on the phone).
    - A screen with no saved copy and no network shows "No connection, Try again" instead of Chrome's error page.
    - Open in Chrome falls back to the phone's own browser when Chrome is missing; an app installed from Samsung Internet gets its own steps and no Chrome button.
    - The steps add the phone's own settings for Chrome (Apps → Chrome → Notifications / Camera) where Chrome's menu has none.
    - The Chats card: a blocked phone gets "Show me how"; an iPhone in Safari is told to add the app to the Home Screen first.
    - Not changed: the build already needs Chrome 107 / Safari 16 (Vite's default); Chrome updates itself on old Android, so nothing new is required.

## Done when

- Each item above is fixed, or moved to a later step with the owner's OK.

## Not in this task

Step 71 (the sellers' move) and the store events RFC.
