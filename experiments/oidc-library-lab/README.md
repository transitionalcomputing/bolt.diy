# Experimental OIDC library verification lab

Not application-integrated or deployable. Fake identities, credentials and locally
generated ephemeral test signing keys only. Do not place real secrets here.
The package/lockfile are isolated; Bolt's root dependencies are unchanged.

Run from this directory:
```
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run test:workerd
```
The installation downloads published packages; test requests themselves do not
contact external services. Node test global fetch throws and the protocol uses a
closed mocked token/JWKS transport. Workerd outboundService throws.

Verified locally with Node24.22.1: openid-client6.9.0, oauth4webapi3.8.8,
jose6.2.17. Sixteen library/integration/virtual-DOM/SQL-engine tests pass: valid signed RS256 identity, rejection of
wrong signature/issuer/audience/nonce/expiry/state, missing ID token, unknown kid,
and foreign metadata endpoint. Actual JWS validation is explicitly enabled with
openid-client enableNonRepudiationChecks, not merely decoded claims.

Local Miniflare4.20260730.0/workerd1.20260730.1 smoke also passes: signed fake token resolves
alice with exactly two mocked calls; wrong state rejected. Uses compatibility
2026-08-06 and nodejs_compat. Exact deployed date 2026-10-01 could NOT be tested:
"This Worker requires compatibility date 2026-10-01, but the newest date supported
by this server binary is 2026-08-06." This is a local tool limitation, not evidence
that the deployed application cannot run. No deployed setting was changed.

Adapter configuration must be server-owned. All endpoints are HTTPS and same
origin as the configured issuer; request-derived metadata is forbidden. Fetch
redirects fail closed. No dynamic discovery, key persistence, token logging or
refresh token retention is implemented. Callback URL is exact and CSRF state,
nonce, PKCE, issuer/audience/time and RS256 signature checks are required.

The local orchestration now supplies the full callback URL and expected state
required by this adapter. One fake-only integration test exercises real library
verification through the mock token/JWKS transport, session issuance, replay
rejection, CSRF-guarded fake-key save and resolution from a second mock browser.
This is NOT app, HTTP-server, real-browser, or real-Authentik integration.
Atomic transaction consumption/browser binding and authorization remain required.
Production needs reviewed discovery or verified metadata, client credential
storage, durable session/transaction/vault repositories, bounded timeout and
error handling, logout/revocation policy, actual deployed runtime tests, and
separate test Authentik provider/hostname. No production deployment authorized.

References:
- https://github.com/panva/openid-client
- https://github.com/panva/openid-client/blob/main/docs/functions/enableNonRepudiationChecks.md
- https://docs.goauthentik.io/add-secure-apps/providers/oauth2/

To test the orchestration suite too, run `node --test ../account-keys-prototype/*.test.mjs` from this directory (75 tests). Neither suite makes real provider requests.

`node sqlite-runtime-probe.mjs` is a negative compatibility check for the separate
Node SQLite experiment. On this local workerd binary, DatabaseSync throws
`Illegal constructor`; the probe passes by confirming unsupported behavior.
It does not attempt to create a file or access a live database.

## Worker-compatible local storage experiment
Run `node d1-test.mjs`. It bundles d1-worker.mjs and uses only Miniflare's local
D1-style binding with a fresh temporary persistence directory, deleted afterward.
No remote D1 service/account/database is created. Eight simultaneous requests
consume one transaction exactly once; disposing/recreating the worker runtime
preserves the fake encrypted credential and session, rejects the second user,
and keeps the transaction consumed. Node crypto vault operations run in workerd.

This is runtime recreation in one test driver process, not a full host restart,
power-loss/backup test or production deployment proof. The worker fixture trusts
its test action to choose fake subjects and is NEVER deployable. No real-key,
OIDC or HTTP account-route integration is included in this binding test.

A D1-style binding avoids the nonfunctional node:sqlite stub. Coolify's actual
worker launch/binding/persistence lifecycle still requires inspection and review:
do not assume preview-mode persistence is a supported durable production store.
Alternatives remain a reviewed private Node credential service with a persistent
volume or a supported worker-compatible database service. No infrastructure
choice, production binding, Cloudflare database, or live configuration was changed.


## Supported Node storage integration slice
`account-integration.test.mjs` composes the real OIDC library adapter, the HTTP
handler, server sessions, guarded account service and Node SQLite vault adapter.
It uses mocked token/JWKS responses signed with ephemeral test keys, synthetic
Fetch requests and a temporary local database only. Global fetch rejects all
real networking. Tests exercise two mock Alice browsers, isolated Bob, replay
rejection, secret-free status, per-session logout, authorization revocation and
credential/session continuity after closing/reopening the service's database
connection. This latter check is service reconstruction, not a new process;
the separate sqlite.test.mjs already tests true process-exit persistence.

No application listener, reverse-proxy routing, live Authentik login, browser UI
or deployed account feature is created by this test. For the current Coolify
architecture, a dedicated reviewed Node account service with persistent storage
is the preferred production-design candidate, NOT a promotion of vite preview's
local database simulation. Its transport/authentication boundary, operational
backup/restore and secret lifecycle still require design/review before deployment.

PKCE coverage: the composed fake identity provider now compares the S256 hash
of the submitted verifier with the challenge recorded at authorization. A wrong
verifier is rejected and normal mock login succeeds. This is synthetic protocol
coverage, not verification of the real Authentik provider configuration.


Virtual DOM tests use isolated jsdom as a development-only dependency. No scripts
or resources are loaded from real sites. They verify input clearing, button/status
updates and safe error text. This is not a real browser test and does not validate
browser cookie policy, TLS, redirects through the actual proxy or accessibility.


## Offline Postgres-WASM validation
`postgres-engine.test.mjs` uses isolated PGlite to execute the draft schema and
actual parameterized queries. Tests verify upsert/JSONB/namespace/check-constraint
behavior, hostile identifier treated as data, DELETE RETURNING consume, and
file-backed close/reopen of encrypted fake credentials with second-user and
wrong-master-key rejection. External fetch is blocked; only temporary test files
are used and removed. No PostgreSQL server, Supabase project, network connection,
real key, database role or production migration is touched.

PGlite runs a single-user PostgreSQL engine in WASM. Eight submitted take promises
are serialized by its client; that is NOT multi-session/concurrent server proof.
Close/reopen is not a separate process or crash/power-loss test. This establishes
SQL compatibility in this engine, not deployed PostgreSQL version compatibility,
RLS/authenticated roles/PostgREST permissions, TLS, pooling or operational durability.
See https://pglite.dev/docs/about and https://github.com/electric-sql/pglite.


## Bounded inert ZIP intake lab

`zip-intake.mjs` uses pinned yauzl with lazy sequential entries, strict names and
size validation, then the pure inert-manifest validator. Five synthetic ZIP tests
cover binary preservation, compressed package text, traversal/symlink/encryption,
CRC corruption, false and excessive declared sizes, a highly compressed oversized
payload, collisions and file-count limits. This increases this lab to 22 tests.
No archive was downloaded, extracted to disk, imported into Bolt or executed.

The parser snapshots at most 32 MiB compressed input, allows at most 2,000 total
entries / 1,000 files, 8 MiB per output file and 32 MiB total output. Both advertised
and actual streamed sizes are checked. Only stored/deflate methods are accepted;
special Unix types and encrypted entries are rejected. CRC32 detects corruption,
not authenticity. A five-second cooperative deadline destroys the active stream;
this is not hard CPU/memory isolation or a proven cancellation benchmark. Temporary
copies mean peak memory exceeds raw payload limits. The caller must bound uploads
before buffering, authenticate/authorize and rate-limit, and use a resource-isolated
worker before accepting real untrusted archives. No recursive archive processing.

Parser semantics use central-directory names; original archive bytes must not later
be fed to a different extractor. ZIP64/Unicode metadata/interoperability fuzzing,
OS portability, MIME/secret/malware inspection, signed provenance, ownership and
atomic durable persistence are not validated by these five tests. Returned manifest
buffers remain internal mutable data. Package scripts are retained inert, never run.
Official library guidance: https://github.com/thejoshwolfe/yauzl


One additional synthetic test composes parsed ZIP bytes with the owner-scoped
workspace service and its Map repository: Alice restores binary data while Bob is
denied. It makes no network calls, uses fake identity/CSRF and neither executes
package scripts nor proves production session or persistent-database isolation.
