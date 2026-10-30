#!/usr/bin/env bash
# Local Go and an app's Vite together, on the environment's (staging's) database. Usage: dev.sh <app>
if lsof -ti:8080 -sTCP:LISTEN >/dev/null; then
    echo "Port 8080 is taken: stop the other pnpm backoffice first." >&2
    exit 1
fi
trap 'kill 0' EXIT
if [ -n "$READ_ONLY" ]; then
    echo "!!! PRODUCTION DATABASE: writes are refused at the local proxy, sign-in excepted !!!"
    export POSTHOG_KEY= POSTHOG_FLAGS_KEY=
fi
(cd "$(dirname "$0")/../api" && PORT=8080 go run ./cmd/api) &
API_ORIGIN=http://localhost:8080 pnpm --filter "@tea-pos/$1" exec vite
