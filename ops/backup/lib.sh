# shellcheck shell=bash
# Shared by backup.sh and restore.sh. Never echo a variable here: they hold secrets.

# The schemas a restore needs: our tables, and Supabase's logins and file records.
# shellcheck disable=SC2034 # used by the scripts that source this file
SCHEMAS=(public auth storage)

log() { # level msg [extra JSON fields, starting with a comma]
    printf '{"level":"%s","msg":"%s","service":"backup"%s}\n' "$1" "$2" "${3:-}"
}

r2_url() {
    printf 'https://%s.r2.cloudflarestorage.com/%s/%s' "$R2_ACCOUNT_ID" "$R2_BUCKET" "${1:-}"
}

# curl signed for R2. The keys go in on stdin, so they never show in the process list.
r2_curl() {
    printf 'user = "%s:%s"\n' "$R2_ACCESS_KEY_ID" "$R2_SECRET_ACCESS_KEY" |
        curl --config - --fail --silent --show-error --max-time 600 --retry 3 \
            --aws-sigv4 "aws:amz:auto:s3" "$@"
}

require() {
    local name
    for name in "$@"; do
        if [[ -z "${!name:-}" ]]; then
            log error "missing variable" ",\"name\":\"$name\""
            exit 2
        fi
    done
}

# Rows per table, as "schema.table|count" lines; the restore compares these.
# Only our tables and the users: Supabase's sign-in logs and tokens change during the dump itself.
# shellcheck disable=SC2034 # used by the scripts that source this file
COUNTS_SQL="SELECT table_schema || '.' || table_name || '|' || (xpath('/row/n/text()',
  query_to_xml(format('SELECT count(*) AS n FROM %I.%I', table_schema, table_name), false, true, '')))[1]::text
FROM information_schema.tables
WHERE table_type = 'BASE TABLE'
  AND (table_schema = 'public' OR (table_schema = 'auth' AND table_name = 'users'))
ORDER BY 1"
