# Task 017e — Writes and lists: saved once, errors in words, lists that page

**Status: planned 2026-10-24, waiting on the owner's review.**

## The goal

Three patterns every later screen uses, built once: a write that is saved exactly once however many times it is sent (a double tap, a retry on slow 4G, a resend after a timeout), an error the user reads in their own language, and a list that loads a page at a time and catches up on what is new.
RFC: Testing ("the same order sent twice is saved once"), Translations stay in the apps, Errors (`{status, code, message}`). Build order Step 17e (from Step 29: every write needs it, not only orders).

## Where it stands today

- Every error is `{status, code, message}` with a stable `code` (`internal/httpx`); the apps do not translate codes yet
- No write routes beyond sign-in and sign-out; no list routes

## The plan

### Saved once

1. **`Idempotency-Key` on every write** (POST, PATCH, DELETE) from `packages/api-client`: a key made when the user acts, kept across that action's retries, new for the next action
2. **Go keeps each key's answer for 24 hours** (`idempotency_keys`: key, user, route, status, body; a migration), in middleware every write route passes: the first request runs and its answer is stored in the same transaction as the change; a repeat gets the stored answer without running again; a repeat while the first is still running gets 409 `in_progress` and the app waits and asks again. A key reused for a different route or body is refused (422)
3. **Declared per route:** `auth.SignedIn.Idempotent()` beside the access rule, and the permission test checks every write route has it, as it checks access today
4. **Tests:** integration: the same request twice saves one row and both answers are the same; two at once save one; the key of one user does nothing for another

### Errors in words

5. **Every `code` has an English and Indonesian line** in `packages/i18n` (`errors.<code>`), and the typecheck fails when Go has a code the apps do not translate (the codes are listed in the contract: an enum generated into `schema.d.ts`)
6. **One way to show them:** `useApiMutation` (wraps React Query's mutation with the key, the retry rule from 016c, and the translated message for the screen) and a toast in `packages/ui` for errors that belong to no field

### Lists

7. **Cursor paging, one shape:** list routes take `?cursor=&limit=` and return `{items, next}` (`next` empty at the end), ordered by time then id so a page never repeats or skips a row; a helper in `internal/handler` and in sqlc queries
8. **Catch-up with `since`:** a list can ask `?since=<time>` for only the rows changed after its newest one, used when 017b tells it something changed (the RFC's catch-up, for lists)
9. **In the apps:** `useInfiniteList` over React Query, and a list component in `packages/ui` with "load more" at the end and the shell's pull to refresh; saved on the phone like every query
10. **Tests:** integration: paging through a list returns every row exactly once while rows are added in between; `since` returns only newer rows

## Owner's part

None.

## Done when

- A write sent twice (a test that retries on a cut connection) is saved once, and the phone shows one result
- Every error code Go can send has both languages, and a missing one fails the typecheck
- A list of a few hundred rows pages smoothly on the 20× throttled profile and catches up without reloading the rest

## Not in this task

- The first real write and list screens: with their features (Step 18 onward)
