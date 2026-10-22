# Task 012 — Sign-in

**Status: planned 2026-10-22, waiting on the owner's review. Built ahead on a branch while Railway is down; the PR merges only after Steps 8, 11 and 9.**

## The goal

"Continue with Google" signs a user into seller or backoffice through the Go API, with a session Go owns and a cookie no JavaScript can read. Every API route then knows who is calling, for which tenant, in which role, and refuses everyone else.
RFC: Build order Step 12; Auth and realtime; Testing (the permission test, the error table).

## Why this replaces v1's approach

- **v1's API checks nobody:** `proxy.ts` runs only on page addresses, and every `/api` route takes the user, role and tenant from plain, JavaScript-readable cookies (`x-user-info`, `x-tenant-id`), then queries with the service role. Anyone can write those cookies. Not fixed in the old app (owner's call, 2026-10-22: v2 replaces it within weeks)
- **v2 checks every API request** against Go's own session table; role and tenant come from the database, never from the browser. The permission test fails any route left open
- **Faster:** most requests need no network call to check the caller (a one-minute in-memory cache); the cookie is 32 bytes instead of a few KB of Supabase tokens on every request; no hourly token refresh to fail on bad signal; a phone can be logged out by deleting its session

## How signing in works

1. The app's button goes to `/api/auth/google`. Go makes a PKCE pair, keeps the verifier in a short-lived cookie (10 minutes, `HttpOnly`, path `/api/auth`) and redirects to Supabase's `/auth/v1/authorize?provider=google` with the challenge and `redirect_to` = the app's own `/api/auth/callback`
2. Google → Supabase (unchanged) → the app's `/api/auth/callback?code=...` → Go exchanges the code with the verifier (`/auth/v1/token?grant_type=pkce`, the publishable key). Supabase is not used again after this
3. Go checks the user against `public.users`: a known role allowed in this app (seller: `USER` and `ADMIN`; backoffice: `ADMIN`) and, for seller, `status = 'active'`, as today. Then it creates a **session** and sets the cookie `session`: a random 32-byte token, `HttpOnly`, `Secure`, `SameSite=Lax`, on that app's address only, 30 days
4. Go redirects to `/`. A refused user lands on `/login?error=<code>` and the sign-in screen shows why (translated)

**Which app is calling:** the forwarder adds `X-App` (`seller` or `backoffice`, from each app's `wrangler.toml`) and `X-App-Origin` (the address the user sees, so a PR preview's callback returns to that preview). Go trusts both only behind the edge secret.

## The plan

1. **Migration** (`supabase migration new sessions`): `public.sessions`: `id`, `token_hash` (SHA-256 of the cookie, never the token itself), `user_id` → `users`, `app`, `created_at`, `last_seen_at`, `expires_at`, `ip`, `user_agent`. Row-level security on with no policies: only Go's connection reads it, never the old app
2. **Tests see the new migration** (Step 9's item 2, pulled forward because this is the first migration): `db-schema.sh` marks the newest migration in the dump; `testkit` loads the dump, then every newer migration file
3. **`internal/auth`**: the PKCE start and callback, the Supabase token exchange (plain `net/http`, no Supabase library), session create, look up and delete (sqlc). Sessions are looked up per request through a small in-memory cache (one minute), so most requests skip the database
4. **Routes** (Huma, in the contract): `GET /auth/google`, `GET /auth/callback`, `POST /auth/logout` (deletes the session, clears the cookie)
5. **Middleware**, every route declares who may call it, once, where it is registered:
   - **login**: no valid session → 401 `not_signed_in`
   - **tenant**: tenant-scoped routes carry the tenant in the path (`/tenants/{tenant}/...`, the slug the apps already use); not assigned → 403 `not_in_tenant`
   - **role**: a role the route does not allow → 403 `not_allowed`
   - **rate limit**: sign-in routes, per caller IP (`X-Client-IP`), in memory: 10 a minute → 429 `too_many_requests`
6. **The permission test**: reads every route from `openapi.yaml`; each must declare its access (public, signed in, or roles), or the test fails. For each protected route: no session → 401, wrong role → 403, another tenant → 403
7. **The apps**: the sign-in button goes to `/api/auth/google`; `/login?error=` shows the reason; any 401 from the API sends the app to `/login` (one place, in `packages/api-client`). Logout UI comes with the account screen (Step 27)
8. **`CLAUDE.md`**: how a route declares access

## Owner's part

**Supabase, staging and production:** Authentication → URL Configuration → Redirect URLs, add:
- `https://tea-pos-staging.lykostech.app/api/auth/callback`, `https://tea-office-staging.lykostech.app/api/auth/callback` (staging project)
- `https://tea-pos.lykostech.app/api/auth/callback`, `https://tea-office.lykostech.app/api/auth/callback` (production project)
- previews and the laptop, staging project only: `https://*.tea-pos-d8i.pages.dev/api/auth/callback`, `https://*.tea-office.pages.dev/api/auth/callback`, `http://localhost:5173/api/auth/callback`, `http://localhost:5174/api/auth/callback`

**Infisical**, Staging and Production `/app`: `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` (Project Settings → API).

The Google Cloud Console does not change.

## Decided in review

- **Sessions last 30 days in both apps,** renewed while used
- **The test-key sign-in moves to Step 15** (owner's call): it exists only for the staging end-to-end tests, needs a staging-only Railway build setting and a staging secret, and comes with the fake staging users those tests sign in as. The permission test stays here: it runs in CI on throwaway databases and is what catches a route left open

## Done when

- On the laptop (local Go on the staging database, the app on `localhost`): Google sign-in works in both apps; a backoffice sign-in by a `USER` is refused with a clear message
- The permission test passes over every route, and fails when a route forgets to declare its access
- Integration tests: callback creates a session; a revoked session gets 401; the rate limit gives 429
- After Steps 8, 11 and 9: the same on the staging addresses

## Not in this task

The test-key sign-in and the fake staging users (Step 15), `/me` and the per-user saved cache (Step 13), the logout screen (Step 27), WebSocket sign-in (Step 26), "log out everywhere" in the UI.
