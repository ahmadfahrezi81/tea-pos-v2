# Task 062 — Afternoon round: sessions, sign-in Back, names

**Status: built 2026-11-08 on `fix/afternoon-round` (#135), waiting on the owner's review and merge.**

## The goal
Three small items from the clean-up RFC's Afternoon round (items 2, 4a, 5): [RFC: Sunday clean-up](https://app.notion.com/p/41295a71540581f9b7f2d251dba69f4c).

## The plan
1. **Sessions (Tea-Office, People → a person → Sessions):** the app as a badge beside the device (`Badge` gains `tone`: Seller blue, Office orange), so the subtitle is "Active today · IP" and fits. Log out on a row opens the confirm sheet first (`ConfirmSheet`, as Log out everywhere). `apps/backoffice/src/uac/Sessions.tsx`, `packages/ui/controls/Badge.tsx`, `uac.logoutOneTitle` / `logoutOneBody`.
2. **Sign-in, Back from Google:** the page comes back from the back-forward cache with the button spinning; on `pageshow` with `persisted` the button is drawn fresh. `packages/shell/screens/SignInScreen.tsx`.
3. **Names:** Tea-POS becomes Tea-Seller (`apps/seller/app.config.ts`). Staging, previews and a laptop build as "Tea-Seller Dev" / "Tea-Office Dev" (manifest, iOS home-screen title, tab title), from `APP_VERSION` in `packages/config/vite.ts`. Icons unchanged.

4. **Store page (item 1), from the owner's quick rounds:** the totals panel's tiles become label and value rows under the chart (Total cups; a range: Cups/day, Best day; one store's day: Status, Seller while open), the store status card goes; store cards as the cash summary (Opening, Revenue, Expected; + Sales, − Expenses, Actual), the variance as a bar only when off, the status badge top right; latest orders' rows open the orders list; Pay's lists framed; Orders and Analytics (both apps): totals as tiles in one card with the chart, no Totals heading.
5. **Seller: Orders picks a day, Analytics a month (item 3):** `apps/seller/src/home/period.tsx` (`?date=`, `?month=`), `PickerButton` shared with the backoffice's RangeBar, `DateRangeSheet` gains `single`, `months`, `custom`. **This month and the two before** (calendar months, the RFC's recommendation). Go refuses a seller anything earlier (`too_far_back`, `domain.SellerEarliest`, checked in `storeScope`), tested in `TestSellerHistoryWindow`.

## Owner's part
- Reinstall the apps on the phone to see the new names (iOS never renames an installed app).
- The lykostech.app site still says Tea-POS (`../lykostech-site`).

## Done when
- A staging build's manifest says "Tea-Seller Dev", a release's "Tea-Seller" (checked with `APP_VERSION=staging` and `2026.11.12`).
- Owner checks the sessions page and the sign-in Back on the preview.

## Not in this task
Items 1 (Store page), 3 (seller day and month picker), 4b (iOS keyboard): the RFC.
