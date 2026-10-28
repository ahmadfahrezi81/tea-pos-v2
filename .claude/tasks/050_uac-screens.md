# Task 050 — UAC: people and their access

**Status: built 2026-10-28, not committed; waiting on the owner's review (built ahead of review, at the owner's ask).**

## The goal

The UAC tab: everyone in the tenant and what each can reach; an admin sets a person's level per app, stores and active, in one save.
RFC: [Backoffice v2 refinement](https://app.notion.com/p/40595a7154058188873dd594ee4b7875), Core 3; Step 50.

## The plan

1. **`GET /tenants/{tenant}/uac`** (backoffice guests read): requests waiting (empty until Step 51) and everyone, with each app's level (as `auth.LevelIn` reads it: rows, else `users.role`), owner, active, stores
2. **`GET` and `PUT /tenants/{tenant}/uac/people/{userId}`** (`PUT`: admins, `.Idempotent()`): one transaction sets each app's level (a row, or none), the membership's status, exactly the stores given (of this tenant only), then `users.role` for v1 (`ADMIN` for an owner or a backoffice admin in any tenant, else `USER`; `DRIVER` and `SUPPLIER` untouched). Turning someone off also clears their stores here, so v1's seller app shows them nothing. Refused: a level the app does not offer (`bad_level`), changing the owner (`owner_kept`), turning yourself off (`not_yourself`), another tenant's store, someone not in the tenant (`person_not_found`). Announces `access` on the tenant (UAC refetches) and on the person (their app reloads `/me`, `live.ts`)
3. **Screens** (`uac/`, area `uac` in both languages): the list (Waiting, then People: `Seller · Backoffice admin`, Owner, Inactive) and a person's page (the name as the title; Seller None / Member, Backoffice None / Guest / Admin; stores; Deactivate / Activate; Save with a confirm). A guest sees it all, changes nothing; the owner's page is read only with a note

## Done when

- Integration test `TestUac` (the list; a guest refused; levels, stores and `users.role` after each save; turned off is out on the next request; every refusal); typecheck, lint, bundle
- The owner checks on staging

## Not in this task

- Request access and approving (Step 51)
