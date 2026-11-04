# Task 057 — A looping app cannot cost us, and we hear about it

**Status: approved 2026-11-05, in PR.**

## The goal

On 2026-11-04 production's backoffice asked `GET /me` about 20 times a second (2.2k requests in 12 minutes on Railway's graph, all `403 not_allowed`, `backoffice@2026.11.3`). The session was the owner's Mac, still signed in as a user the owner had made `inactive`. Go refused every call, but the session lived on and the app kept asking. It stopped only when Claude deleted the session in the database: an old app already sends a 401 to sign in.

Each refusal costs Go almost nothing (0 ms, no database). The real cost is the edge: every call goes through the `/api` Pages Function, and Cloudflare's free plan allows 100,000 a day for the whole account. One phone at 20 a second uses that up in under 1.5 hours, and then `/api` fails for every user until the day resets.

So Go does what fixed it by hand, for every build of the app, old ones included: it ends a session that cannot work, and one calling like a loop.

## The plan

1. **Go ends a refused session** (`internal/auth/middleware.go`): when a session's user is no longer allowed in the app (made inactive, access removed), Go deletes the session and clears the cookie on the same `403 not_allowed`. The app's next call is a `401`, which every build already sends to sign in; signing in as that user is refused at Google's return (`handler/auth.go`), as today. A session sent to the other app's address is still only refused (cannot happen through the forwarders; tests do it)
2. **Go ends a session calling like a loop** (same file, `handler/register.go`): every signed-in session is capped (step 8: 600 requests a minute), in memory like the sign-in limit (`Limiter`, keyed by the session). Past it: the session ends, `429 too_many_requests` with the cookie cleared, and an error log with the user, app and path, which reaches PostHog. Not the usual answer (most APIs only say 429 and wait), but only ending the session also stops an old app that does not know 429
3. **The loop itself** (`packages/shell/frame/ShellLayout.tsx`), found by reproducing it with a fake API that refuses everything (109 `/me` in 4 s on the old code): MobileShell draws the screens only while `ready`, and `ready` went false again each time `/me` was asked with nothing saved. The screen unmounted, mounted again, and each mount asks `/me`: a loop. Now `ready` stays true once the shell has shown. With this alone the old `me.ts` stops at 3 calls
4. **The app says why** (`packages/api-client/me.ts`): a `403` on `/me` (the early request from index.html, or the later one) goes to `/login?error=not_allowed`, "This account cannot use this app". One `/me`, then the sign-in screen (checked against the fake API)
5. **Turning someone off signs them out** (`handler/uac.go`, `SyncUserStatus` returns the new status, `internal/auth/sessions.go` `ForgetUser`): when saving a person in UAC leaves them active in no tenant, every session of theirs ends at once and their phones are told (`signed_out`), as Log out everywhere does. Still active in another tenant: the session stays for that tenant, and Go drops it from its one-minute memory so the change applies from their next request
6. **The app brakes itself** (`packages/api-client/brake.ts`, `index.ts`): past 50 calls to one address in 10 seconds (5 a second; live updates in a rush stay far below), that address rests 30 seconds, twice as long each time it trips again (up to 10 minutes). Its calls are held until the rest ends, then answered on the phone with `too_many_requests` (in `FINAL`, not retried): they never leave the phone, so they cost neither Cloudflare nor Go, and held rather than answered at once, the phone itself does not spin (checked: the old loop with the brake made 51 calls, then 1 page change in 5 s instead of 17,000)
7. **The person sees it** (`packages/shell/frame/useErrorToasts.ts`, `ShellLayout.tsx`): a toast when the brake trips ("Too many tries…", and an error event `client brake: <path> called too often`, which reaches PostHog), and when a refresh fails behind data still on screen (same words not twice in 10 s; sign-in, maintenance and update have their own screens). `/me` failing with nothing saved shows the profile screen with Refresh and Retry instead of a blank page
8. **Go caps a session** at 600 requests a minute (10 a second), not 300: room for live updates in a rush
9. **The edge stops an address** (later, not now) (owner's click, Cloudflare): one rate limiting rule (the free plan has one): more than 100 requests in 10 seconds from one IP blocks it for 10 seconds, on both apps' `/api/*`. It runs before the Pages Function, so blocked calls do not count toward the 100,000. For a loop Go cannot see (a 401 loop, a public route)
10. **The owner hears about it** (PostHog, owner's click): an alert on the error "session too fast, signed out", by email

## Owner's part

- Cloudflare: Security → WAF → Rate limiting rules → the rule in step 9 (Claude writes the clicks)
- PostHog: the alert in step 10 (Claude writes the clicks)
- On staging: sign in as a test user, mark them inactive, reload: one `/me` refused, then the sign-in screen with the message

## Done when

- Integration tests: a person turned off in UAC, whose session Go had in memory, gets a 401 on their next request and has no session left (`TestUac`); a refused session's next call is a 401 and its cookie is cleared (`TestAccess_RefusedSessionEnds`); past the cap a session ends with 429 while another carries on (`TestAccess_TooFastSessionEnds`). Passing
- The brake: normal use passes, a loop trips once, rests, doubles (`brake.test.ts`). Passing
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, the Go integration tests pass. Passing

## Not in this task

- A shared cap across API instances (one instance today; the cap is per instance)
