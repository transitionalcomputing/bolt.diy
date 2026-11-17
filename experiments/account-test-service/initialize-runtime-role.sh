#!/bin/bash
# Fresh dedicated test DB only. No global logging/security setting changes.
set -euo pipefail
fail(){ echo 'Test runtime role initialization failed' >&2; exit 1; }
[[ "${BOLT_RUNTIME_PASSWORD:-}" =~ ^[0-9a-f]{64}$ ]] || fail
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -v ON_ERROR_STOP=1 >/dev/null 2>&1 <<'SQL' || fail
CREATE ROLE bolt_test_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
GRANT USAGE ON SCHEMA bolt_private TO bolt_test_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON bolt_private.records TO bolt_test_runtime;
GRANT SELECT, INSERT ON bolt_private.workspace_snapshots TO bolt_test_runtime;
SQL
# psql's password command encrypts client-side, avoiding cleartext SQL/log passwords.
# Must run without a TTY as the official image's init hook; validate natively first.
printf '%s\n%s\n' "$BOLT_RUNTIME_PASSWORD" "$BOLT_RUNTIME_PASSWORD" |
 psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -v ON_ERROR_STOP=1 -c '\password bolt_test_runtime' >/dev/null 2>&1 || fail
unset BOLT_RUNTIME_PASSWORD
