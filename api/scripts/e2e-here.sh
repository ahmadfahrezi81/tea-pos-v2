#!/usr/bin/env bash
# The e2e suite against the API from this checkout and a throwaway Postgres: on every PR, and on a
# laptop (needs psql and TEST_DATABASE_URL). Staging's run stays the test of the real Railway,
# Cloudflare and Supabase. Run from api/.
set -euo pipefail

: "${TEST_DATABASE_URL:?TEST_DATABASE_URL is required}"
export DATABASE_URL=$TEST_DATABASE_URL
export ENV=staging PORT=${E2E_PORT:-18080} EDGE_SECRET=e2e-edge-secret-e2e-edge-secret-e2e-edge-secret
export TEST_LOGIN_KEY=e2e-test-login-key-e2e-test-login-key-e2e-test-login-key-0000
export SUPABASE_URL=http://localhost:1 SUPABASE_PUBLISHABLE_KEY=unused

# It wipes the database, so only ever a local one.
case "$DATABASE_URL" in
    *@localhost:* | *@127.0.0.1:*) ;;
    *) echo "TEST_DATABASE_URL must be a local throwaway database"; exit 1 ;;
esac
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q >/dev/null <<'SQL'
SET client_min_messages = warning;
DROP SCHEMA IF EXISTS public, river CASCADE;
DO $$ DECLARE r text; BEGIN
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('CREATE ROLE %I NOLOGIN', r);
        END IF;
    END LOOP;
END $$;
SQL

for f in db/stubs.sql db/schema.sql db/pending.sql tests/e2e/seed.sql; do
    PGOPTIONS='-c client_min_messages=warning' psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$f" >/dev/null
done

bin=$(mktemp -d)/api
go build -tags testlogin -ldflags "-X github.com/ahmadfahrezi81/tea-pos-v2/api/internal/version.Version=staging" -o "$bin" ./cmd/api
"$bin" > "${E2E_API_LOG:-/dev/null}" 2>&1 &
api=$!
trap 'kill "$api" 2>/dev/null || true' EXIT

for _ in $(seq 40); do
    curl -fsS "http://localhost:$PORT/health" >/dev/null 2>&1 && break
    kill -0 "$api" 2>/dev/null || { echo "the API did not start"; exit 1; }
    sleep 0.5
done

E2E_API_URL=http://localhost:$PORT E2E_EDGE_SECRET=$EDGE_SECRET \
    go test -tags e2e -count=1 -v ./tests/e2e/
