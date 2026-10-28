# Task 051 — Request access

**Status: built 2026-10-28, not committed; waiting on the owner's review.**

## The goal

Someone signs in with Google, opens a tenant's address, taps Request access; a backoffice admin lets them in (levels, stores), rejects, or blocks them in UAC.
RFC: [Backoffice v2 refinement](https://app.notion.com/p/40595a7154058188873dd594ee4b7875), Core 3, Request access; Step 51.

## Decided (owner, 2026-10-28)

Any Google account that signs in gets an empty account: `users` row with `role` `USER`, `status` `pending`, no tenant, no app. It reaches only `/me` and the request; every tenant route refuses it, and v1 lets a pending account in nowhere.

## What was built

1. **Sign-in** (`handler/auth.go`): no `users` row makes one (`CreatePendingUser`, name from Google, else the email). `auth.Allowed` lets a pending account with no levels sign in to either app; the tenant check reads the account's status fresh (`GetUserTenant.user_status`), so seller needs an active account and someone just let in gets in at once
2. **`POST /access-requests`** `{tenant}` (signed in, rate limited, repeatable): one waiting request per person and tenant; a member, a blocked person or an unknown slug get the same 204 and nothing is made. Announced on the tenant, so UAC refreshes. `/me` gains `asked` (slugs still waiting; blocked looks the same)
3. **UAC:** `GET /uac/requests/{id}`; `POST …/approve` (the person's fields, in one transaction: membership, then Step 50's `setPerson`, the request approved, the account active); `POST …/reject` `{block}`. Error `request_not_found`
4. **Migration** (Step 47c's, not yet run): request status gains `blocked`
5. **Screens:** a tenant's address the user is not in shows No access yet with Request access, then Request sent (`packages/shell/HomeScreen.tsx`, both apps). UAC's waiting rows open the request page: the level and store fields shared with the person page (`AccessFields`), Let in, Reject, Block
6. **Test:** `access_requests_test.go`; `auth_test.go` signs in a new account as pending

## Not in this task

- A badge on the UAC tab for waiting requests (suggestion)
- Inviting by email (not asked for)
