# Task 057 — A refused /me stops asking

**Status: planned 2026-11-04, waiting on the owner's review.**

## The goal

On 2026-11-04 production's backoffice asked `GET /me` about 20 times a second for 2 minutes (1,967 answers of `403 not_allowed`, `backoffice@2026.11.3`). The session belonged to a user who is `inactive` with no app access: Go keeps refusing them, and the app kept asking. A session Go refuses must send the phone to sign in, once.

## The plan

1. **`packages/api-client/me.ts`:** a `403 not_allowed` on `/me` (the early request from index.html or the later one) goes to `/login?error=not_allowed`, like a 401 goes to `/login`. The sign-in screen already says what `not_allowed` means (`signIn.errors.notAllowed`). Only `/me`: elsewhere a 403 can be one route the user's level does not reach
2. **`useMe`:** `retryOnMount: false`, so a failed `/me` is not asked again just because another screen that reads it mounts. A refused `/me` with no saved copy flipped the query between error and loading on every new fetch, which is what kept it asking
3. Check by hand on staging: sign in as a test user, mark them inactive in the database, reload: one `/me`, then the sign-in screen with the message

## Done when

- A refused `/me` costs one or two requests (the early one and the retry-free one), then the sign-in screen
- `pnpm lint`, `pnpm typecheck`, `pnpm test` pass

## Not in this task

- A rate limit on signed-in routes (today only sign-in routes have one, per IP): a suggestion for later, as a Cloudflare rule or `.RateLimit()` on more routes
- Ending the session in Go when it is refused
