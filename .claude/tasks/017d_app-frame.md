# Task 017d — The app frame: tenant and store, flags, Account and More

**Status: planned 2026-10-24, waiting on the owner's review.**

## The goal

Everything both apps need around their own screens is built once in `packages/shell`: which tenant and store the user is working in, the flags for them, and the Account and More screens (profile, language, sign out, version, What's new). The app steps then only add their own screens.
RFC: One component library, The backend decides (permissions as flags). Build order Step 17d (from Steps 24 and 27).

## Where it stands today

- `/me` returns the user, their tenants with stores (seller: assigned; backoffice: all), each store's flags, and the user's flags (016b)
- The shell has a home screen with the status rows; no tenant in the address, no store choice, no Account screen
- The old app: routes under `[tenantSlug]`, a default store per user, a More menu with patch notes (a TypeScript file per app, written by a skill), language, account

## The plan

1. **The tenant in the address:** every screen under `/<tenant>/…` (TanStack Router), as the old app; `/` goes to the user's tenant (the only one, or the last used). The API's tenant routes already take the slug
2. **The chosen store:** the store the app works in, kept on the phone per user (default: `isDefault` from `/me`); a switcher in the header when the user has more than one; changing it changes every screen's queries (the store id is part of their keys)
3. **`useFlag(key)`:** the flag for the chosen store (its `flags` from `/me`), falling back to the user's; no flag code elsewhere. Reminder in its comment: the route behind it must check too (the RFC's rule)
4. **Account** (both apps, one screen): name and avatar (avatar upload through 017c), email, role, the language switch (saved to the profile: `PATCH /api/me`, and the phone's copy), sign out, sign out everywhere (017b sends the other phones to sign-in), the version and commit (from 016b; the status rows move here from home)
5. **What's new** (both apps, one screen): the release notes' "For users" lines, in English and Indonesian, per app. They live in the repo as `packages/shell/whats-new/<locale>.json` (newest first, each entry tagged with its apps), loaded only when the screen opens; the `release` skill adds the entries in a small PR to `staging` before the release PR, so the tag, the GitHub Release and the screen say the same. A dot on More when there is an entry the user has not seen
6. **More** (both apps): the menu that holds Account, What's new, and each app's own entries (registered by the app: `staticData`, like the shell's titles)
7. **Tests:** integration: `PATCH /api/me` changes only the caller's language and rejects an unknown one. In the app: switching the store refetches the screen with the new store; a flag off for one store and on for another follows the switch

## Owner's part

None.

## Open questions

1. **Backoffice and the chosen store:** the backoffice today shows every store of the tenant, with no store chosen. Keep it that way (no switcher in backoffice; a screen that needs one store asks for it), or give it the same switcher? I recommend no switcher in backoffice
2. **Old patch notes:** start v2's What's new empty, or copy the old app's recent entries? I recommend empty: v2 is a new app, and its first entry says so

## Done when

- Both apps open on `/<tenant>/`, and a user with two stores switches between them; every screen follows
- Account changes the language at once and keeps it on the next open, on another phone too
- What's new shows the latest release's "For users" lines in the user's language, with a dot until seen
- The first screen does not grow: Account, More and What's new load when opened

## Not in this task

- Each app's own More entries (supply, feedback map, requests…): with their features
