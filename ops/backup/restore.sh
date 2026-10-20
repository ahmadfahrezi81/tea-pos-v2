#!/bin/bash
# Restore a backup from R2 into an empty database, then compare row counts with the
# ones taken at backup time.
#   restore.sh latest | restore.sh postgres/2026/10/21/200000
# Needs R2_* and TARGET_URL: an empty Postgres 17 database, connected as a superuser.
set -Eeuo pipefail
# shellcheck source=lib.sh
source /usr/local/bin/lib.sh

require R2_ACCOUNT_ID R2_BUCKET R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY TARGET_URL
key=${1:?usage: restore.sh latest | restore.sh <key without .dump>}

if [[ "$key" == latest ]]; then
    # Keys sort by date (postgres/YYYY/MM/DD/HHMMSS), so the last one is the newest.
    key=$(r2_curl "$(r2_url)?list-type=2&prefix=postgres/" |
        grep -o '<Key>[^<]*\.dump</Key>' | sed -e 's/<Key>//' -e 's/\.dump<\/Key>//' | sort | tail -1)
    [[ -n "$key" ]] || { log error "no backups in the bucket"; exit 1; }
fi
log info "restoring" ",\"key\":\"$key.dump\""

r2_curl --output /tmp/restore.dump "$(r2_url "$key.dump")"
r2_curl --output /tmp/restore.counts.txt "$(r2_url "$key.counts.txt")"

# The roles row-level security policies name, and the schema extensions live in: Supabase has them, a plain Postgres does not.
psql "$TARGET_URL" -X -q -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE r text;
BEGIN
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('CREATE ROLE %I NOLOGIN', r);
        END IF;
    END LOOP;
END
$$;
-- The dump creates public itself; an empty Postgres already has one.
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
SQL

pg_restore --exit-on-error --single-transaction --no-owner --no-privileges \
    --dbname="$TARGET_URL" /tmp/restore.dump
log info "restored"

psql "$TARGET_URL" -X -A -t -v ON_ERROR_STOP=1 -c "$COUNTS_SQL" >/tmp/restored.counts.txt
if diff <(sort /tmp/restore.counts.txt) <(sort /tmp/restored.counts.txt) >/tmp/counts.diff; then
    log info "row counts match" ",\"tables\":$(wc -l </tmp/restored.counts.txt)"
else
    log error "row counts differ; lines with < are the backup's, > the restored copy's"
    cat /tmp/counts.diff
    exit 1
fi
