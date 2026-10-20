---
name: release
description: Promote staging to production with a release PR staging → main. Use when the owner says "release", "ship to prod" or "promote staging".
---

# Release

A release promotes exactly what `staging` runs to production. Only the owner decides when.

## Before

- `staging`'s API end-to-end tests are green on its latest commit (the release PR requires it)
- No PR the owner wants in this release is still open
- List what is going out: `git log --oneline --first-parent origin/main..origin/staging`

## The PR

- **Base `main`, head `staging`.** Never another branch (`release-source` refuses it)
- **Title:** `release: YYYY.MM.N`, the version this release will be tagged with (Nth release this month: `gh release list` shows the last one)
- **Body:** one line per change, from the squash commits above, grouped:
  - **For users** (anything a seller or the owner can notice), plain words
  - **Internal** (CI, refactors, docs)
  - **Migrations:** list each new file in `supabase/migrations/` since the last release, or "none"
- No attribution lines

```bash
gh pr create --base main --head staging --title "release: YYYY.MM.N" --body "..."
```

## Merging

- **Merge commit, never squash** (`gh pr merge <n> --merge`): a squash gives `main` a commit `staging` never had, and the next release conflicts
- If there are migrations, the owner approves the production migration job in GitHub; the API deploys after it
- After deploy: production `/health` shows the merge commit
- `release.yml` then tags the merge commit `YYYY.MM.N` and creates the GitHub Release with this PR's body as notes; check it exists (`gh release view`)
- The notes are written for three readers: this PR (you, before merging), the GitHub Release (history), and later the in-app What's new, which shows only the **For users** lines in English and Indonesian (Step 16)
