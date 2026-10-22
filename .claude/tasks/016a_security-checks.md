# Task 016a — Security checks

**Status: done 2026-10-22, PR #16. CI green (`govulncheck` clean, `dependency-review` passing, Docker on Go 1.27.3); `staging` ruleset requires `dependency-review`; the owner turned on Dependabot alerts and security updates and CodeQL default setup (Go, JavaScript/TypeScript, Actions). Open: the first Dependabot PRs (Monday) and CodeQL's first results.**

## The goal

GitHub tells us about vulnerable or outdated dependencies and unsafe code before they reach `staging`, at no cost (the repo is public). Nothing here needs Railway.
RFC: Build order Step 16a; CI/CD, Security and updates.

## Found while planning

`govulncheck` against today's code finds **9 vulnerabilities our code actually calls**: 8 in Go's standard library (`net/http`, HTTP/2, `crypto/tls`, `crypto/x509`, `mime/multipart`, all fixed in Go 1.27.3; we pin 1.27.1) and 1 in `golang.org/x/text` v0.40.0 (fixed in v0.41.0). The Dockerfile's `golang:1.27-alpine` floats, so deployed images may already be newer, but CI and the laptop build with 1.27.1. They are fixed first, so the new check starts green.

## The plan

1. **Fix what exists:** `api/go.mod` to `go 1.27.3`; `golang.org/x/text` to v0.41.0 (`go get`, `go mod tidy`); the Dockerfile pinned to `golang:1.27.3-alpine` (Dependabot keeps it current from now on, instead of a tag that changes under us)
2. **`govulncheck` in CI:** a step in `checks` (`go run golang.org/x/vuln/cmd/govulncheck@v1.9.0 ./...` in `api/`). It fails only on vulnerabilities our code calls, so a flagged-but-unused package does not block a PR
3. **Dependabot** (`.github/dependabot.yml`): weekly, Monday, **one grouped PR per ecosystem** into `staging`: npm (the pnpm workspace), Go modules (`api/`), GitHub Actions, Docker (`Dockerfile`, `ops/backup/Dockerfile`). Titles `chore(deps): ...` like our commits. Security fixes arrive at once, outside the weekly batch
4. **Dependabot PRs and our CI:** Dependabot PRs get no repo secrets and a read-only token, so `pages.yml` (needs Cloudflare) and the PR-comment steps skip them; the checks still run and gate the merge
5. **Dependency review** (`.github/workflows/security.yml`, `actions/dependency-review-action@v5`): on every PR into `staging`, fails if the PR adds a package with a known vulnerability of **high** severity or worse
6. **CodeQL: GitHub's default setup** (a settings click, no YAML to maintain): scans Go, JavaScript/TypeScript and the Actions workflows on every PR and weekly
7. **`staging` ruleset:** `dependency-review` becomes a required check (`.github/rulesets/staging.json`, applied with `gh api`)
8. **`CLAUDE.md`:** Dependabot PRs are reviewed and squash-merged like any other; a red `govulncheck` means bump the module or Go itself

## Owner's part

GitHub, the repo's **Settings → Advanced Security** (the "Code security" page):
1. **Dependabot alerts:** Enable. **Dependabot security updates:** Enable
2. **CodeQL analysis:** Set up → **Default** → languages as suggested (Go, JavaScript/TypeScript, Actions) → Enable CodeQL
3. Secret scanning and push protection are already on (checked)

## Done when

- `govulncheck` runs in `checks` and is green
- The first Dependabot PRs open into `staging`, one per ecosystem, and their checks run
- A PR adding a known-vulnerable package fails `dependency-review`
- CodeQL shows a first completed scan under the Security tab

## Not in this task

Monitoring and versions (Step 16b). Railway-side image scanning. A Go upgrade beyond the 1.27 patch line.
