#!/usr/bin/env bash
# An app on a local copy of staging's database, with this checkout's new migrations (db/pending.sql)
# applied: for trying a feature whose tables staging does not have yet. Staging is only read.
# Usage: scripts/local-db.sh <seller|backoffice>   (FRESH=1 copies staging again)
# Needs Homebrew's postgresql@17 and `infisical login`. Sign in with Google as on staging.
set -euo pipefail
trap 'kill 0' EXIT
cd "$(dirname "$0")/.."

PG=/opt/homebrew/opt/postgresql@17/bin
DIR="${LOCAL_DB_DIR:-$HOME/.tea-pos/local-db}"
mkdir -p "$(dirname "$DIR")"
PORT=5433
GO_PORT=8090
URL="postgres://postgres@localhost:$PORT/postgres?sslmode=disable"
LOG="$DIR.log.d"
mkdir -p "$LOG"
staging() { (cd api && infisical run --silent --env=staging --path=/app -- bash -c "$1"); }

if ! "$PG/pg_isready" -h localhost -p "$PORT" -q; then
    if [ ! -d "$DIR" ]; then
        LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 "$PG/initdb" -D "$DIR" -U postgres --auth=trust --locale=en_US.UTF-8 >/dev/null
    fi
    "$PG/pg_ctl" -D "$DIR" -o "-p $PORT -k /tmp" -l "$LOG/postgres.log" start >/dev/null
fi

if [ "${FRESH:-}" = 1 ] || [ -z "$("$PG/psql" "$URL" -Atc "SELECT to_regclass('public.users')")" ]; then
    echo "Copying staging into the local database…"
    "$PG/psql" "$URL" -q -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
SET client_min_messages = warning;
DROP SCHEMA IF EXISTS public, river, auth, extensions CASCADE;
CREATE SCHEMA public;
DO $$ DECLARE r text; BEGIN
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role', 'supabase_admin'] LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('CREATE ROLE %I NOLOGIN', r);
        END IF;
    END LOOP;
END $$;
SQL
    PGOPTIONS='-c client_min_messages=warning' "$PG/psql" "$URL" -q -f api/db/stubs.sql >/dev/null
    staging "$PG/psql \"\$DATABASE_URL\" -c \"\\copy (SELECT id, email FROM auth.users) TO STDOUT\"" |
        "$PG/psql" "$URL" -q -c "\\copy auth.users (id, email) FROM STDIN"
    # Supabase's own parts (publications, grants) do not apply here: their errors are expected.
    staging "$PG/pg_dump --no-owner --no-privileges --no-publications --schema=public --schema=river \"\$DATABASE_URL\"" |
        sed -e '/^\\restrict /d' -e '/^\\unrestrict /d' -e '/^CREATE SCHEMA public;/d' |
        PGOPTIONS='-c client_min_messages=warning' "$PG/psql" "$URL" -q >/dev/null 2>"$LOG/copy.log" || true
fi

(cd api && bash scripts/pending.sh)
echo "Applying this checkout's new migrations…"
PGOPTIONS='-c client_min_messages=warning' "$PG/psql" "$URL" -q -f api/db/pending.sql >/dev/null 2>>"$LOG/copy.log" || true

if ! lsof -ti:"$GO_PORT" -sTCP:LISTEN >/dev/null; then
    (cd api && infisical run --silent --env=staging --path=/app -- \
        env DATABASE_URL="$URL" PORT="$GO_PORT" go run ./cmd/api) &
fi
# Vite's proxy adds EDGE_SECRET, which Go needs on every request.
infisical run --silent --env=staging --path=/app -- \
    env API_ORIGIN="http://localhost:$GO_PORT" pnpm --filter "@tea-pos/$1" exec vite
