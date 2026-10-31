#!/bin/bash
# Dumps the staging database's public and river schemas (structure only) to db/schema.sql,
# marked with the newest migration staging has run; pending.sh picks up the rest.
# Run through `pnpm --filter @tea-pos/api db:schema`, which passes DATABASE_URL from Infisical.
set -euo pipefail
cd "$(dirname "$0")/.."

: "${DATABASE_URL:?run through pnpm db:schema, which reads it from Infisical}"

# postgres:17 so pg_dump matches Supabase's server; \restrict lines are pg_dump's, not SQL.
docker run --rm -e DATABASE_URL postgres:17 sh -c \
    'echo "-- migrations through: $(psql "$DATABASE_URL" -Atc "SELECT max(version) FROM supabase_migrations.schema_migrations")" &&
     pg_dump --schema-only --no-owner --no-privileges --schema=public --schema=river "$DATABASE_URL"' |
    sed -e '/^\\restrict /d' -e '/^\\unrestrict /d' >db/schema.sql.tmp
mv db/schema.sql.tmp db/schema.sql
bash scripts/pending.sh
echo "db/schema.sql: $(grep -c '^CREATE TABLE' db/schema.sql) tables"
