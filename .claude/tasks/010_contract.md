# Task 010 — The contract

**Status: built 2026-10-21, uncommitted, waiting on the owner's code review. `/health` served through Huma, unchanged; `openapi.yaml` and `schema.d.ts` generated and checked by `generate:check`; a bad request gives 400 `bad_request` with details, an unexpected error 500 `internal` with no internals, an unknown route 404 `route_not_found` (added: the mux's own 404 was plain text). Lint, typecheck and format pass.**

## The goal

Request and response shapes are written once, as Go structs; from them come request checks, `api/openapi.yaml`, and the typed TypeScript client the apps will use. Errors reach the apps as stable codes.
RFC: Build order Step 10, Backend (API contract), Frontend (API client and hooks).

## The plan

1. **Huma** (`danielgtaylor/huma/v2`) on the standard `net/http` mux (its `humago` adapter). JSON only: Huma's CBOR support is switched off, so nothing unused ships
2. **`internal/contract/`**: the request and response structs, one file per domain, with their checks as struct tags (`minLength`, `enum`, ...). Huma rejects a bad request before the handler runs
3. **`/health` moves onto Huma**, so the spec has its first operation (same response as today)
4. **Errors as stable codes** (`internal/httpx/`): every error body is `{"code": "day_already_closed", "message": "...", "status": 409}`. `code` is what the apps translate; `message` is for logs. One place maps errors to status codes (404, 409, ...), replacing Huma's default error shape
5. **`api/openapi.yaml`, generated, never edited:** a small program (`cmd/openapi`) prints the spec; `pnpm --filter @tea-pos/api generate` writes it together with sqlc's code. `generate:check` (already in CI's `checks`) fails if either is out of date
6. **`packages/api-client`**
   - `schema.d.ts`: types generated from `openapi.yaml` by `openapi-typescript`
   - `client.ts`: an `openapi-fetch` client on `/api` (the app's own address, Step 11) and `openapi-react-query` hooks over it
   - About 7 KB together; no response is re-checked in the browser (RFC principle 8)
7. **Docs page off for now:** Huma serves `/docs` by default; it stays off until admins can sign in (Step 12)
8. **`CLAUDE.md`:** where shapes live, how to regenerate, the error format

## Owner's part

- Review this file. Nothing to click

## Done when

- `GET /health` is served through Huma, unchanged on the outside
- `api/openapi.yaml` lists it; `packages/api-client` typechecks against it
- A bad request answers 400 in the stable error shape; an unknown error answers 500 without internals
- Changing a struct without regenerating fails `checks`

## Not in this task

Roles on each route and the permission test (Step 12, with sign-in), real endpoints (`/me` is Step 13), the apps that use the client (Step 14).
