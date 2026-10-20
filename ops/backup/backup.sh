#!/bin/bash
# One nightly run: dump production, check the file, count rows, upload both to R2,
# and report to healthchecks.io, which emails the owner when a night fails or never reports.
set -Eeuo pipefail
# shellcheck source=lib.sh
source /usr/local/bin/lib.sh

require DATABASE_URL R2_ACCOUNT_ID R2_BUCKET R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY HC_PING_URL

hc() { # path [body]; a failed ping must not fail the backup
    curl --fail --silent --show-error --max-time 10 --retry 3 --output /dev/null \
        --data-raw "${2:-}" "$HC_PING_URL$1" || log warn "healthchecks ping failed"
}

step=start
on_error() {
    # A failure inside $(...) also fails the line around it: report once, from the main shell.
    [[ $BASHPID == "$$" ]] || exit "$1"
    log error "backup failed" ",\"step\":\"$step\",\"exit\":$1"
    hc /fail "step=$step exit=$1"
    exit "$1"
}
trap 'on_error $?' ERR

hc /start

key="postgres/$(date -u +%Y/%m/%d/%H%M%S)"
dump=/tmp/backup.dump
counts=/tmp/backup.counts.txt
schema_args=()
for s in "${SCHEMAS[@]}"; do schema_args+=(--schema="$s"); done

step=dump
# Owners and grants are Supabase's own roles: left out, so the dump restores into any Postgres.
timeout 10m pg_dump --format=custom --no-owner --no-privileges "${schema_args[@]}" \
    --dbname="$DATABASE_URL" --file="$dump"
bytes=$(stat -c %s "$dump")
log info "dumped" ",\"bytes\":$bytes"

step=verify
pg_restore --list "$dump" >/dev/null

step=count
psql "$DATABASE_URL" -X -A -t -v ON_ERROR_STOP=1 -c "$COUNTS_SQL" >"$counts"
log info "counted" ",\"tables\":$(wc -l <"$counts")"

step=upload
r2_curl --upload-file "$dump" -H "Content-Type: application/octet-stream" "$(r2_url "$key.dump")"
r2_curl --upload-file "$counts" -H "Content-Type: text/plain" "$(r2_url "$key.counts.txt")"
log info "uploaded" ",\"key\":\"$key.dump\""

step=finish
hc "" "key=$key.dump bytes=$bytes"
log info "backup done" ",\"bytes\":$bytes"
