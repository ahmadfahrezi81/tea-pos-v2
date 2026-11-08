# Task 062 — Afternoon round: sessions, sign-in Back, names

**Status: built 2026-11-08 on `fix/afternoon-round`, waiting on the owner's review.**

## The goal
Three small items from the clean-up RFC's Afternoon round (items 2, 4a, 5): [RFC: Sunday clean-up](https://app.notion.com/p/41295a71540581f9b7f2d251dba69f4c).

## The plan
1. **Sessions (Tea-Office, People → a person → Sessions):** the app as a badge beside the device (`Badge` gains `tone`: Seller blue, Office orange), so the subtitle is "Active today · IP" and fits. Log out on a row opens the confirm sheet first (`ConfirmSheet`, as Log out everywhere). `apps/backoffice/src/uac/Sessions.tsx`, `packages/ui/controls/Badge.tsx`, `uac.logoutOneTitle` / `logoutOneBody`.
2. **Sign-in, Back from Google:** the page comes back from the back-forward cache with the button spinning; on `pageshow` with `persisted` the button is drawn fresh. `packages/shell/screens/SignInScreen.tsx`.
3. **Names:** Tea-POS becomes Tea-Seller (`apps/seller/app.config.ts`). Staging, previews and a laptop build as "Tea-Seller Dev" / "Tea-Office Dev" (manifest, iOS home-screen title, tab title), from `APP_VERSION` in `packages/config/vite.ts`. Icons unchanged.

## Owner's part
- Reinstall the apps on the phone to see the new names (iOS never renames an installed app).
- The lykostech.app site still says Tea-POS (`../lykostech-site`).

## Done when
- A staging build's manifest says "Tea-Seller Dev", a release's "Tea-Seller" (checked with `APP_VERSION=staging` and `2026.11.12`).
- Owner checks the sessions page and the sign-in Back on the preview.

## Not in this task
Items 1 (Store page), 3 (seller day and month picker), 4b (iOS keyboard): the RFC.
