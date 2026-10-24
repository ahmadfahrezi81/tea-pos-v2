# Task 017b — The realtime service: live updates for both apps

**Status: planned 2026-10-24, waiting on the owner's review.**

## The goal

When something changes (an order saved, a store session handed over, a claim approved), every phone that shows it updates within a second, in either app, without anyone pulling to refresh. One hub, every connection signed in.
RFC: Auth and realtime, Services on Railway (WebSocket ping), Backend (Realtime). Build order Step 17b (moved from Step 26: both apps will use it).

## Where it stands today

- `cmd/realtime` only answers `/health`
- The old app uses Supabase Realtime, only for the store session; v2 replaces it with this hub when Step 28 is rebuilt

## The plan

1. **How a change travels:** the API saves the change, then (after the commit) `pg_notify('changes', …)` with a small message: `{"topic": "store:<id>", "kind": "order", "id": "<id>"}`; never the data itself (the phone fetches it through the API as usual, so permissions and shapes stay in one place). A helper in `internal/realtime` builds and sends it, inside the same transaction, so a rolled-back change announces nothing (Postgres delivers a NOTIFY only on commit)
2. **The hub** (`cmd/realtime`): one dedicated connection `LISTEN`s (outside the pool; the session pooler allows it), and fans each message out to the sockets subscribed to its topic. WebSocket library: `github.com/coder/websocket` (small, standard-library style; the newest release at least two weeks old)
3. **Signed in by the cookie:** the browser sends the app's session cookie with the WebSocket request, so the hub checks it against the sessions table exactly as the API does (`internal/auth`, shared); no ticket step. Through the same forwarder: `/api/realtime` goes to the realtime service (`packages/edge` learns a second origin, `REALTIME_ORIGIN` in each app's `wrangler.toml`), with the edge secret
4. **Topics, decided by the server:** a socket asks for `store:<id>`, `tenant:<id>` or `user:<id>`; the hub allows only what the user may see (their own `user:`, the tenants and stores `/me` lists). A topic not allowed is refused, not silently ignored
5. **Kept alive:** a ping every 30 seconds (Cloudflare drops a connection idle for about 100 seconds); the hub closes a socket that stops answering
6. **In the apps** (`packages/api-client/live.ts`, loaded after the first screen like `events.ts`): one socket per app, opened while the app is visible, closed a minute after it goes to the background (no battery drain on a parked phone), reopened with backoff. Each message invalidates the queries that show it (a small table: `kind: "order"` → the store's order queries), so React Query refetches only what is on screen
7. **Catch-up after a gap:** when a socket reopens after being closed (background, no signal), every query on screen refetches once: simple, and nothing is missed. The RFC's `since` (only what changed since a time) comes with lists in Step 17e, where a list can ask for just its new rows
8. **The first live event, so it is proven before any feature:** signing out everywhere (or an admin suspending a user) closes that user's sessions and sends `user:<id>` `kind: "signed_out"`: every phone of that user goes to sign-in at once
9. **Tests:** integration tests with the hub in-process: a socket without a valid session is refused; a socket may not subscribe to another tenant's store; a NOTIFY reaches only that topic's sockets; a rolled-back change sends nothing. e2e on staging: a socket through the forwarder receives the sign-out of its own session

## Checked first

That a Pages Function passes a WebSocket through to Railway with its cookie (Cloudflare's Workers do; a Pages Function is one): tried on a preview before the hub is built. If it does not, the fallback is a route on the realtime service's own Cloudflare address, written down before going on.

## Owner's part

None expected: the realtime service and its variables already exist in `railway.ts`; `REALTIME_ORIGIN` goes in `wrangler.toml` (not a secret).

## Open questions

1. **Catch-up by refetching (above) instead of a changes table read with `since`:** simpler, and correct, at the cost of one refetch per screen after a gap. I recommend it; a changes table only if a screen ever needs history it cannot refetch

## Done when

- Signing out everywhere on one phone sends the user's other phone to sign-in within a second
- The hub refuses a socket without a session, and a topic the user may not see
- A phone in the background holds no socket after a minute, and is current again a moment after it returns
- The first screen grows by nothing (`live.ts` loads after it)

## Not in this task

- The store session live on the hub: Step 28
- Chat and push notifications: after every store runs v2
