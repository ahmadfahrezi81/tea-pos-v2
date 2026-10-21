#!/bin/bash
# Dumps the staging database's public schema (structure only) to db/schema.sql.
# Run through `pnpm --filter @tea-pos/api db:schema`, which passes DATABASE_URL from Infisical.
set -euo pipefail
cd "$(dirname "$0")/.."

: "${DATABASE_URL:?run through pnpm db:schema, which reads it from Infisical}"

# postgres:17 so pg_dump matches Supabase's server; \restrict lines are pg_dump's, not SQL.
docker run --rm -e DATABASE_URL postgres:17 sh -c \
    'pg_dump --schema-only --no-owner --no-privileges --schema=public "$DATABASE_URL"' |
    sed -e '/^\\restrict /d' -e '/^\\unrestrict /d' >db/schema.sql.tmp
mv db/schema.sql.tmp db/schema.sql
echo "db/schema.sql: $(grep -c '^CREATE TABLE' db/schema.sql) tables"
