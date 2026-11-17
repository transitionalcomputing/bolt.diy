# Separate workspace-only test harness candidate

Not deployed. No live Bolt imports, AI calls, key-vault routes or generated-code
execution. Candidate target slit-cool-02; hostname `bolt-test.signallayerit.com`
is provisional. This is a test shell for login/upload/list/download, not Bolt editor.

## What exists

Explicit configuration parser, Node/pg/OIDC bootstrap, account-only routes, inert ZIP
upload, owner-scoped metadata listing (first50), attachment JSON download, static DOM
UI and private-database compose draft. UI uses textContent, no local credential
storage or HTML rendering of imported files. Secure session/CSRF comes from existing
experimental auth modules. Two subjects must be explicitly configured. AI-key URLs
return404. Bootstrap never applies schema or grants and emits fixed error messages.

Core workspace service now supports listing with explicit owner predicate; SQL returns
summary columns only, not all project blobs. The harness limits imports to one in
flight per process,25 projects/account,8MiB upload,4MiB resulting snapshot and120
requests/minute globally per process. These test admission controls can cause denial
of service to other test users, reset on restart, and are not distributed quotas or
full protection. Production needs durable quotas,
per-account rate limits, parser process isolation and explicit data retention.

## Build/provision sequence (requires review before execution)

1. Review exact host/origin/TLS/private network plan and approve security changes.
2. Validate image/container in isolation; no Docker engine available in current lab.
3. Securely create dedicated DB/admin/runtime credentials. Apply both reviewed SQL
   schemas in an empty test database. Runtime role: USAGE private schema; SELECT,
   INSERT, UPDATE, DELETE on records; SELECT, INSERT on workspace_snapshots. No
   database/schema/role creation or administrative role. Verify grants and owner
   separation using a real PostgreSQL server before accepting even fake test imports.
4. Provision separate confidential signed OIDC provider with exact callback and two
   test-user allowlist, securely inject client secret. Do not change live providers.
5. Inject required env from compose draft. DATABASE_TLS defaults to no assumption:
   `verify-full` requires trusted server certificates; `approved-private-test-network`
   disables DB TLS only for an explicitly approved isolated private Docker hop.
   No SSL overrides allowed in connection URL. Do not expose DB ports.
6. Add only approved test-host routing preserving Host; retain HTTPS verification
   toward proxy. The app discards forwarded identity headers and uses signed login.
7. Real-browser tests: two users import different fake archives, log out/back in,
   restart test services and verify ownership and persistence. No real projects yet.

Dockerfile/compose are drafts: build, image digest pinning, vulnerability checks,
health/readiness, TLS, secrets injection, migration/role steps and network attachments
are not verified. Node pool uses bounded connection/query timeouts. Clean shutdown
is basic; active upload/database error recovery needs real container tests. No claim
of production readiness or real Authentik browser success follows from unit tests.

Additional jsdom tests exercise the actual browser script: safe text-only listing,
ZIP submit with CSRF/redirect rejection/no localStorage, and failed signout clearing
stale project UI without claiming success. This is not actual browser cookie behavior.
An empty-environment subprocess bootstrap test fails closed before DB connection.
Startup checks required tables exist but not the full permission matrix.


Startup and a once-minute timer purge expired auth transaction/session rows only;
credentials and workspaces are excluded. Parameter and PGlite SQL tests verify the
predicate. Failures emit a fixed message; operational alerting/retention backups are
still required. OIDC transport combines caller cancellation with its10-second
upstream deadline. Admission tests now cover concurrent import rejection,25-project
cap,4MiB output cap and fixed-window rate reset. These remain single-process controls.

Malformed/missing/noninteger auth expiry is treated as invalid and removed by the
cleanup query, rather than causing a cast failure or immortal auth record. Scope
remains only session/transaction namespaces; SQL-engine regressions cover this.


## Test-only revocation behavior

Local app sessions last up to one hour. Disabling/removing a user only in Authentik
does not immediately invalidate an already established local session: no back-channel
logout or live IdP account-status polling is implemented. This is a production gate,
not a reason to bypass Authentik restrictions. The test service rechecks its explicit
issuer/subject allowlist per request; update that test configuration and restart
only the test service to revoke local access. A synthetic retained-session test
reconstructs auth with a changed allowlist and confirms the old user's cookie fails
while the other approved user's cookie remains valid. Actual test deployment must
repeat this behavior in browsers and record the limitation before any rollout.

For the eventual two-browser test, `node generate-test-fixtures.mjs NEW_DIRECTORY`
creates two distinct fake ZIPs plus expected hashes/base64. It refuses overwriting
existing filenames. A parser roundtrip test verifies each archive's distinct binary
content. These contain only generated data; no user project is accessed or migrated.

Workspace download now revalidates persisted canonical base64, totals, paths and
hashes before returning an attachment. This catches corruption, not maliciously
recomputed hashes; storage encryption/permissions and backups remain required.

Fixture generation is not atomic: an existing directory is allowed and an error can
leave earlier newly created files behind. Existing files are never overwritten.
Stored SHA256 values are consistency checks, not authenticated provenance.
