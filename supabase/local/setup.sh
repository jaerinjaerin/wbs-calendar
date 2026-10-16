#!/bin/sh
# Recreates the local database from schema.sql + seed.sql. Wipes local data only.
set -e
cd "$(dirname "$0")/.."
PG=/opt/homebrew/opt/postgresql@16/bin
DB=wbs_calendar

$PG/dropdb --force --if-exists $DB
$PG/psql -q -d postgres -c "drop role if exists authenticator, anon, authenticated, service_role"
$PG/createdb $DB
$PG/psql -q -v ON_ERROR_STOP=1 -d $DB -f local/roles.sql -f schema.sql -f seed.sql
echo "local db ready: postgres://localhost:5432/$DB"
