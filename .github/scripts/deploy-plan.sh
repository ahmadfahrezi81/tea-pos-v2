#!/usr/bin/env bash
# What a deploy has to do, as name=value lines: everything changed since the last deploy that
# passed, so a deploy that failed or never ran is caught up by the next one. Run it on a laptop to
# see the answer: GITHUB_REPOSITORY, GITHUB_REF_NAME and GITHUB_SHA set, gh signed in. PLAN_BASE
# replays another comparison; PLAN_CHANGED supplies the files, for the tests.
set -euo pipefail

if [ "$GITHUB_REF_NAME" = main ]; then env=production; else env=staging; fi

# The PR this commit came from: a squash into staging, or the release into main.
if [ -z "${PLAN_CHANGED+x}" ]; then
    pr=$(gh api "repos/$GITHUB_REPOSITORY/commits/$GITHUB_SHA/pulls" --jq ".[] | select(.base.ref == \"$GITHUB_REF_NAME\") | .number" | head -1 || true)
else
    pr=""
fi

# The release's version is its PR's title (release-source checks it); staging has none.
version=staging
if [ "$env" = production ]; then
    title=$(gh pr view "$pr" --repo "$GITHUB_REPOSITORY" --json title --jq .title 2>/dev/null || true)
    version=${title#release: }
    [[ "$version" =~ ^[0-9]{4}\.[0-9]{2}\.[0-9]+$ ]] || version=unknown
fi

if [ -n "${PLAN_CHANGED+x}" ]; then
    changed=$PLAN_CHANGED
    base=given
else
    base=${PLAN_BASE:-$(gh api "repos/$GITHUB_REPOSITORY/actions/workflows/deploy.yml/runs?branch=$GITHUB_REF_NAME&status=success&per_page=30" \
        --jq '[.workflow_runs[] | select(.event != "pull_request")][0].head_sha // ""')}
    # No deploy to compare with, or one this history does not have: only this commit's own changes.
    if [ -z "$base" ] || ! git cat-file -e "$base^{commit}" 2>/dev/null; then base=$GITHUB_SHA^1; fi
    changed=$(git diff --name-only "$base" "$GITHUB_SHA")
fi

everything=${PLAN_EVERYTHING:-false}
has() {
    if [ "$everything" = true ] || grep -qE "$1" <<< "$changed"; then echo true; else echo false; fi
}

services=""
[ "$(has '^(api/|Dockerfile$)')" = true ] && services="api realtime worker"
[ "$env" = production ] && [ "$(has '^ops/backup/')" = true ] && services="$services backup"

echo "env=$env"
echo "pr=$pr"
echo "version=$version"
echo "base=$base"
echo "config=$(has '^\.railway/')"
echo "migrations=$(has '^supabase/migrations/')"
echo "services=$(echo "$services" | xargs)"
echo "apps=$(has '^(apps/|packages/|api/openapi\.yaml$|pnpm-lock\.yaml$)')"
