#!/usr/bin/env bash
# Local Go and an app's Vite together, on the environment's database. Usage: dev.sh <app>
# Staging's Go listens on 8080, production's on 8081; a second app reuses the Go already running.
trap 'kill 0' EXIT
GO_PORT=8080
if [ -n "$READ_ONLY" ]; then
    GO_PORT=8081
    echo "!!! PRODUCTION DATABASE: writes are refused at the local proxy, sign-in excepted !!!"
    export POSTHOG_KEY= POSTHOG_FLAGS_KEY=
fi
if lsof -ti:"$GO_PORT" -sTCP:LISTEN >/dev/null; then
    echo "Reusing the Go already on port $GO_PORT."
else
    # Production's pooler is shared with the deployed services: a laptop takes two.
    (cd "$(dirname "$0")/../api" && PORT="$GO_PORT" DB_MAX_CONNS="${DB_MAX_CONNS:-2}" go run ./cmd/api) &
fi
API_ORIGIN="http://localhost:$GO_PORT" pnpm --filter "@tea-pos/$1" exec vite
