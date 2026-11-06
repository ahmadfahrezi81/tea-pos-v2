# Task 059 — Production's log says what happened

**Status: approved 2026-11-06, in progress.**

## The goal

Reading production's log after release 2026.11.4 (about 1,000 requests over two days) turned up two things that make it harder to read than it should be:

- **91 `posthog` warnings with no text.** `telemetry.go` logs PostHog's own messages under the key `msg`, which the log format already uses for the line's message, so the text is dropped. We cannot tell what PostHog is complaining about
- **13 `status=500` that are not failures.** Each was a request the phone gave up on (a page left or reloaded, `context canceled`). `httpx` already logs those as `cancelled`, not as an error, but the request line still says 500, so the log looks like Go is failing

Two PRs, as the owner asked.

## The plan

1. **PostHog's words** (`api/internal/telemetry/telemetry.go`): the key `msg` becomes `detail` in `quietLogger`'s three lines, so the message shows
2. **A cancelled request is a 499** (`api/internal/httpx/error.go`): when the error is `context.Canceled`, the answer's status is 499 (nginx's "client closed request"; nobody reads the body, the phone has gone), so the request line says 499 and a 500 in the log is always a real failure. An integration test: a request cancelled mid-way is logged as 499

## Done when

- A PostHog warning in staging's log shows its text
- A cancelled request logs `status=499`; `pnpm lint`, `pnpm typecheck`, the Go integration tests pass

## Not in this task

- Whatever the PostHog warnings turn out to say: read once the text shows, fixed in its own change if needed
