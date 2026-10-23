# Task 015 — Test sign-in on staging, and API end-to-end tests

**Status: built 2026-10-24, not committed: the owner reviews the code first. Verified locally: the test sign-in's integration tests pass (and fail when a user in both a test and a real tenant is let through); the production image has no `/auth/test` and the staging-tagged one has it; `seed.sql` runs twice cleanly; the e2e suite passes three times in a row against local Go built with `testlogin` and both apps' production builds, and fails on a wrong commit; `pnpm bench --test-user` signs in without Google. Changed while building: the suite starts from Railway's deployment event, not the push (Railway's Wait for CI would otherwise wait for it forever), and only runs when the API was deployed; `/auth/test` is not rate limited.**

## The goal

Automated tests (and `pnpm bench`) sign in on `staging` as fake test users, without Google, and an end-to-end suite runs against the deployed `staging` after every merge, so a release PR is only merged on green. Production can never take the test sign-in: its binary does not contain it.
RFC: Build order Step 15; Auth and realtime ("Tests on staging"); Testing (API end-to-end tests); CI/CD.

## Already done by earlier steps

PR previews, `staging` deploys with `/health` showing the commit, the PR comments, and releases with migrations then backend then frontend (Steps 6, 9, 11, 14). What is left of Step 15 is the test sign-in and the end-to-end tests.

## The plan

### The test sign-in (Go)

1. **`POST /auth/test`** in `internal/handler/testlogin.go`, behind the build tag **`testlogin`**: a binary built without the tag has no such route, so no setting can switch it on in production. Body `{"email": "..."}`, header `X-Test-Key`
2. It answers only when all of these hold, else 404 like any unknown route:
    - built with `testlogin`, `ENV` is not `prod`, and `TEST_LOGIN_KEY` is set (32+ characters), compared in constant time
    - the user belongs to a **test tenant** (slug starting `test-`): a leaked key still cannot sign in as a real person
3. Then it does what the Google callback does: a real session in the `sessions` table and the same `session` cookie. Everything after that is the production path: `/me`, roles, tenant checks, sign out
4. `auth.Public`, not rate limited (the key cannot be guessed, and the suite signs in many times a minute; with the shared sign-in limit two runs in a minute got 429), and the permission test runs once with the tag too (`go test -tags integration,testlogin`), so the route keeps a rule
5. **Build:** the `Dockerfile` takes `ARG GO_BUILD_TAGS` into `go build -tags`. `railway.ts` sets `GO_BUILD_TAGS: "testlogin"` and `TEST_LOGIN_KEY: preserve()` on **staging's** `api` only; production declares neither. CI builds the image without tags and checks the binary has no `/auth/test`

### The fake staging users

6. **`api/tests/e2e/seed.sql`**, idempotent (`ON CONFLICT DO NOTHING`), run on the staging database before each run: tenants `test-a` and `test-b`, two stores each, and users `seller@test-a.test` (assigned to one store, default), `admin@test-a.test` (ADMIN), `inactive@test-a.test`, `seller@test-b.test`, with their `auth.users` rows. Only rows in `test-` tenants; nothing else is touched. Data, not schema, so it is not a migration

### The end-to-end suite

7. **`api/tests/e2e/`**, build tag `e2e`, against `E2E_BASE_URL` (the staging backoffice and seller addresses, through the Pages forwarder as a phone would). It reuses `testkit` and the generated contract types. Today's flows, growing with every feature step:
    - `/health` reports the commit under test
    - signed out, `/me` is 401; with the key but an email outside the test tenants, 404
    - seller@test-a on seller: `/me` shows test-a and only its assigned store; the same user on backoffice is refused (`not_allowed`)
    - admin@test-a on backoffice: every store of test-a; never test-b's
    - inactive@test-a on seller: refused (`account_inactive`)
    - sign out ends the session: `/me` is 401 again
8. **`.github/workflows/e2e.yml`**:
    - **After Railway deploys `staging`:** started by Railway's GitHub deployment (`deployment_status`), not the push: Railway's Wait for CI waits for every check on a push, so a job waiting for the deploy would wait forever. Runs `seed.sql`, then the suite, which checks every app runs the deployed commit. A change that only touches the apps deploys no API, so the suite waits for the release PR
    - **On a release PR into `main`:** runs the suite against `staging` (which holds exactly that head) and posts its own PR comment section (`e2e`)
    - Reads `TEST_LOGIN_KEY` and `STAGING_DATABASE_URL` from repository secrets
9. **`main`'s ruleset** requires the `e2e` check, so a red suite blocks the release (applied with `gh api`, like the others)

### `pnpm bench` without Google

10. `pnpm bench --test-user admin@test-a.test <url>` signs in through `/auth/test` (key from Infisical staging) instead of the Google profile, so staging benchmarks need no real account. `--sign-in` stays for production and real accounts

### Docs

11. `CLAUDE.md`: the test sign-in rule (staging only, test tenants only, absent from the production binary) and `pnpm --filter @tea-pos/api test:e2e`

## Owner's part

**Infisical:** `TEST_LOGIN_KEY` (`openssl rand -hex 32`, generated straight into Infisical as with the edge secrets; I'll give the command) in **Staging `/app`** and the same value as `TEST_LOGIN_KEY` in **Production `/github`**, so the workflow can read it. Never in Production `/app`.

## Done when

- On staging, `POST /auth/test` signs in `admin@test-a.test` and `/me` shows test-a; an email outside the test tenants or a wrong key gets 404
- Production's `/auth/test` is 404, and its image's binary has no such route (checked in CI)
- A push to `staging` runs the suite after the deploy and reports green; a deliberately broken check makes it red
- The release PR shows the `e2e` result and cannot merge while it is red
- `pnpm bench --test-user admin@test-a.test https://tea-office-staging.lykostech.app` runs without the Google profile

## Not in this task

End-to-end flows for features that do not exist yet (seller day, payouts: each feature step adds its own), browser end-to-end tests (the RFC rules them out), seller benchmarks (later, owner's call).
