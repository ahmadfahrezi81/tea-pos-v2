# Task 004 — The Go skeleton

**Status: done 2026-10-20, reviewed by the owner. Lint and typecheck pass with Go included; `/health` answers with version and commit; a large response is gzipped (a tiny one like `/health` is left alone, as intended); a slow request finishes during shutdown. Docker build not tried: Docker is not running locally (Railway builds it in Step 6).**

## The goal

The Go module and its three programs, each starting, answering `/health` (where it serves HTTP) and shutting down cleanly, in one Docker image. No database, no routes yet.
RFC: Build order Step 4, Backend. Shape taken from Rail Canvas.

## The plan

1. **`api/`, a Go module** `github.com/ahmadfahrezi81/tea-pos-v2/api`, Go 1.27 (an older local `go` downloads it by itself)
2. **Three programs, one per Railway service:**
   - `cmd/api`: HTTP on `PORT`; `GET /health` returns `{"status":"ok","version":"…","commit":"…"}`
   - `cmd/realtime`: the same `/health`; the WebSocket hub comes in Step 26
   - `cmd/worker`: starts, logs, waits for the stop signal; River comes in Step 17
3. **Shared code in `internal/`:**
   - `config/`: reads environment variables (`PORT`, `ENV`, `SHUTDOWN_TIMEOUT`), refuses to start if one is wrong
   - `platform/server.go`: one HTTP server setup for `api` and `realtime`: read, write and idle time limits, graceful shutdown on `SIGTERM` (finish in-flight requests, then exit)
   - `platform/log.go`: `slog` JSON to stdout, every line carrying `service`, `env` and, inside a request, `request_id`
   - `middleware/`: request id, one log line per request (`/health` at debug level), panic recovery, gzip, a time limit per request
   - `version/`: version and commit, stamped at build time
4. **gzip:** `klauspost/compress/gzhttp`, the one dependency. It handles the edge cases (small responses, already-compressed types, `Accept-Encoding`) that a hand-written wrapper gets wrong
5. **`Dockerfile`** at the repo root, as Rail Canvas: Go build stage, then `distroless/static:nonroot`, every program under `/app/`. Each Railway service picks one by its start command. About 10-20 MB
6. **`api/package.json`**, thin, so Turbo covers Go too: `build` (`go build ./...`), `lint` (`gofmt -l` and `go vet`), `typecheck` (`go build`), `test` (`go test ./...`). `api` joins `pnpm-workspace.yaml`
7. **`.env.example`** at the root, listing every variable with a one-line comment
8. **`CLAUDE.md`**: the Go layout and commands

`GOMEMLIMIT` needs no code: Go reads it from the environment. It is set per service in Step 6.

## Owner's part

- Review this file
- Optional: Docker running locally, to try the image. Railway builds it either way from Step 6

## Done when

- `pnpm lint`, `pnpm typecheck` pass, Go included
- `go run ./cmd/api` answers `GET /health` with version and commit, gzipped when asked
- `SIGTERM` during a slow request lets it finish, then the program exits
- `docker build` produces one image with `/app/api`, `/app/realtime`, `/app/worker` (if Docker is running)

## Not in this task

CI (Step 5), Railway (Step 6), database (Step 8), the contract and routes (Step 10), sign-in (Step 11). No tests yet: unit tests live in `internal/domain/`, which has no code yet.
