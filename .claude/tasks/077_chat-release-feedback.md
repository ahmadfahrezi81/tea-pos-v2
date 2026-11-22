# Task 077 — Chat: feedback after the release

**Status: collecting 2026-11-22, the owner's feedback after release 2026.11.15 (chat in the backoffice, for the family).**

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

## Done when

- Each item above is fixed, or moved to a later step with the owner's OK.

## Not in this task

Step 71 (the sellers' move) and the store events RFC.
