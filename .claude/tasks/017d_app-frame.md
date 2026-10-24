# Task 017d — The app frame: tenant and store, flags, Account and More

**Status: built 2026-10-24, not committed. Checked in the browser (backoffice, local Go on the staging database): `/` goes to `/test-a`, the header's store picker opens with All stores, both stores and "hide inactive", picking one keeps it; More lists Account and What's new; Account shows the profile, both sign-outs and the version rows. `PATCH /me` tested (own language only, known languages only). Found: the header is its own layer, so the picker's sheet renders into the page body. First screen 125.8 → 127.9 KB with 017e (budget 130).**

## The goal

Everything both apps need around their own screens is built once in `packages/shell`: which tenant and store the user is working in, the flags for them, and the Account and More screens (profile, language, sign out, version, What's new). The app steps then only add their own screens.
RFC: One component library, The backend decides (permissions as flags). Build order Step 17d (from Steps 24 and 27).

## Where it stands today

- `/me` returns the user, their tenants with stores (seller: assigned; backoffice: all), each store's flags, and the user's flags (016b)
- The shell has a home screen with the status rows; no tenant in the address, no store choice, no Account screen
- The old app: routes under `[tenantSlug]`, a default store per user, a More menu with patch notes (a TypeScript file per app, written by a skill), language, account

## The plan

1. **The tenant in the address:** every screen under `/<tenant>/…` (TanStack Router), as the old app; `/` goes to the user's tenant (the only one, or the last used). The API's tenant routes already take the slug
2. **One store picker for both apps** (the old backoffice's `StorePickerDrawer`, moved into the shell): kept on the phone per user, changing it changes every screen's queries (the store id is part of their keys). Two settings, as the old apps differ on purpose: **seller** works in one store and must pick one (default: `isDefault` from `/me`); **backoffice** looks at stores and also offers **All stores**, its default, with "hide inactive stores" as today
3. **`useFlag(key)`:** the flag for the chosen store (its `flags` from `/me`), falling back to the user's; no flag code elsewhere. Reminder in its comment: the route behind it must check too (the RFC's rule)
4. **Account** (both apps, one screen): name and avatar (avatar upload through 017c), email, role, the language switch (saved to the profile: `PATCH /api/me`, and the phone's copy), sign out, sign out everywhere (017b sends the other phones to sign-in), the version and commit (from 016b; the status rows move here from home)
5. **What's new** (both apps, one screen): the release notes' "For users" lines, in English and Indonesian, per app, starting empty (owner, 2026-10-24). **Written by the `release` skill, not by hand:** before the release PR it takes the "For users" lines, writes their Indonesian, tags each with its apps, and adds them to `packages/shell/whats-new.json` in a small PR to `staging`, so the GitHub Release and the screen say the same. Loaded only when the screen opens; a dot on More while there is an entry the user has not seen
6. **More** (both apps): the menu that holds Account, What's new, and each app's own entries (registered by the app: `staticData`, like the shell's titles)
7. **Tests:** integration: `PATCH /api/me` changes only the caller's language and rejects an unknown one. In the app: switching the store refetches the screen with the new store; a flag off for one store and on for another follows the switch

## Owner's part

None.

## Done when

- Both apps open on `/<tenant>/`; a seller with two stores switches between them, the backoffice between All stores and one; every screen follows
- Account changes the language at once and keeps it on the next open, on another phone too
- What's new shows the latest release's "For users" lines in the user's language, with a dot until seen
- The first screen does not grow: Account, More and What's new load when opened

## Not in this task

- Each app's own More entries (supply, feedback map, requests…): with their features
