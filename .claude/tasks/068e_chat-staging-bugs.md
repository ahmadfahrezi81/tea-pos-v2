# Task 068e — Chat: staging bugs and feedback

**Status: in progress 2026-11-21.**

## The goal

Bugs seen in staging's logs after chat's PRs (#145-#159), and the owner's next feedback, fixed before chat goes to production. Notion: Chat: staging bugs and feedback (child of RFC: Chat (v2)).

## Bugs

1. **`realtime: session lookup`, `context canceled`, logged as an error and answered 500** (realtime, 2026-11-17 16:53 UTC). The phone gave up on the socket while its session was looked up. As the API since #104: a cancel is no failure of ours, so it logs as info and answers 499 (`httpx.StatusClientClosed`), in the session lookup and the topics read. `api/internal/realtime/hub.go`
2. **`SDK ... WARN Response has no supported checksum`** and 3. **`traces export: rpc error ... DeadlineExceeded`**, at the 2026-11-17 13:03 deploy: not ours (below)

**Railway's logs, last 7 days (read 2026-11-21 with the CLI: every service, both environments, warn and error):**

| Where | What | Count | Decision |
| --- | --- | --- | --- |
| staging realtime | `realtime: session lookup`, context canceled | 1 | Fixed (bug 1) |
| staging api | `sign chat photos`, context canceled | 2 | Fixed: a cancel no longer warns (the phone left before the photos were signed) |
| production api | `sign day photos`, context canceled | 1 | Fixed, same |
| both api | `posthog`: fetching flag definitions timed out | 2 per environment, once a day | Left: PostHog's own client, retried on its next poll; flags keep their last values |
| staging api | `test sign-in is on` | each start | Intended (staging only) |
| (none of ours) | `SDK ... checksum`, `traces export ... DeadlineExceeded` | 6, at the 2026-11-17 13:03 deploy | Not in any service's logs for the week (searched): Railway's own platform during the deploy. Nothing to change |

## Feedback

1. **Notifications belong in chat, with no off switch** (owner, 2026-11-21). More's on/off row is gone (`PushRow`); under the list of chats, while this phone does not get them, a card says "Turn on notifications" with one Turn on button (a tap: phones ask only then); once allowed, it is gone. Blocked in the phone's settings: the card says to allow them there. No off switch anywhere, so nobody turns them off by accident; the phone's own settings do that. The helpers move from `shell/lib/push.ts` to `api-client/chat.ts` (chat is push's only user; no new package export)

## Done when

- A cancelled socket logs `cancelled` at info and answers 499; a cancelled photo signing does not warn; the integration tests pass (but `TestSellerCloseDay`, failing on staging too)
