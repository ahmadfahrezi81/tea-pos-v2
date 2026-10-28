# Task 047c — Access per app

**Status: built 2026-10-28, not committed; waiting on the owner's review (built ahead of review, at the owner's ask). Released to production on its own after staging (the RFC's plan).**

## The goal

One account, and for each app a separate level (guest, member, admin), checked in Go on every route; no screens yet.
RFC: [Backoffice v2 refinement](https://app.notion.com/p/40595a7154058188873dd594ee4b7875), Core 3 and The data model; Step 47c.

## The plan

1. **Migration `20261028122732_access_per_app.sql`**, additions only: `user_app_access` (tenant, user, app, access; tied to the membership; seller offers member, backoffice guest and admin), `tenant_access_requests` (for Step 51), `tenants.owner_id`, `user_tenant_assignments.status` (active, inactive). RLS on, no policies. Backfill, harmless twice: `ADMIN` is seller member and backoffice admin, `USER` seller member; the owner is each tenant's earliest admin. Checked on a scratch database: run twice, the second changes nothing
2. **`internal/auth`:** `auth.App(app, level)` replaces `auth.Roles("ADMIN")`; `LevelIn`: the owner is an admin, an inactive member has nothing, a level row decides, no row anywhere in the tenant means `users.role` (people v1 adds while it runs). `Allowed` (who gets into an app at all) reads the apps a user has rows in, else the role. On a tenant route: inactive is `not_in_tenant`; no level in this app, another app's route, or a level too low is `not_allowed`
3. **Routes:** Store and Pay reads `auth.App("backoffice", auth.Guest)`, Pay writes `auth.Admin`. The permission test refuses a backoffice write open to less than admin, and checks every app route against the other app's session and a guest
4. **`/me`:** each tenant gains `access` (`seller`, `backoffice`: the level or '') and `owner`; inactive memberships are left out
5. **Screens:** `useAccess()` in the shell (`level`, `canWrite`, `owner`); `HeaderActions` hides add and edit from a guest; Pay's edit pencils too. Each core step hides the rest of its writes (Steps 48, 49)
6. **Tests:** fixtures gain a backoffice guest and someone turned off; access, owner, permission and `/me` cases

## Open questions

- The double write to `users.role` belongs to whatever first changes a level: Step 50's `PUT`. Nothing in 47c changes levels
- Photo uploads (`internal/files`) still check `users.role` (`ADMIN`): product images are uploaded from the seller app's Manage. Kept until those screens are ported
- The e2e users need no rows: they fall back to their role. A backoffice guest e2e user can come with Step 50

## Done when

- Integration tests pass (they do, Postgres 17); lint, typecheck, `generate:check`
- After the release: `/me` on production shows each admin as backoffice admin, and UAC later shows the owner

## Not in this task

- The UAC screens (Step 50) and Request access (Step 51)
