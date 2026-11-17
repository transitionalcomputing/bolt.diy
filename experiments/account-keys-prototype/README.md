# Isolated account OpenAI credential prototype

Experimental, nonproduction prototype preserved only on the account-workspaces branch. No application integration, real credentials, authentication configuration, or deployment changes.

Run `node --test *.test.mjs` from this directory (Node24 tested; 75 tests).

Core contract:
- Application supplies a reviewed `verifyIdentity(request)` capability. There is deliberately no default header/cookie verifier. Tests use a WeakMap of fake request objects, not user-controlled headers.
- Repository records are scoped by verified issuer/subject and OpenAI provider.
- AES-256-GCM with fresh96-bit nonce,128-bit authentication tag and owner/provider identifier as authenticated additional data. Master encryption key is supplied separately from repository.
- Save/status/delete never return stored key. `resolveForProvider` is internal server-only and returns a key only for provider invocation. It must never back a client-readable route.
- No browser/cookie/shared-environment credential fallback. No logging. Failed decryption returns a fixed error.
- A random credential revision changes on replacement for future cache invalidation.

Limitations before production:
- Memory repository is explicitly test-only, not durable. Re-instantiation test is not evidence of disk/restart persistence.
- Real OIDC identity verification, production authorization policy, durable storage, deployed-runtime crypto compatibility, transport protection, HTTP route integration, audit logs without secrets, backup/restore, master-key rotation and key lifecycle remain unimplemented. Authorization and CSRF/Origin logic are exercised only through injected mock identities and synthetic requests.
- No UI/browser migration and no app routes wired. Cross-browser test uses two fake request objects with same verified identity, not real browser sessions.
- The app's shared OpenAI fallback and all provider routes must be changed in reviewed account mode before live use.
- Server operators controlling application memory/master key can access credentials; encryption at rest does not protect against a fully compromised application.
- Do not integrate or deploy until separately reviewed. Production requires security review plus actual two-user/two-browser isolation tests with fake credentials before any real keys.

## OIDC boundary prototype (isolated experiment)
`oidc.mjs` adds Authorization Code + PKCE orchestration, state/nonce/browser
binding, atomic one-use callback transactions, opaque server sessions, expiry,
local logout and Origin+CSRF mutation checks. The `protocol` adapter is deliberately
injected and mock-only in tests: no production JWT verifier or token exchange is
implemented. The fake adapter accepts test subjects as codes and MUST NEVER be
selected by an application. `createMockStore` is not durable or distributed.

From the repository root run `node --test experiments/account-keys-prototype/*.test.mjs`: 75 tests pass under Node24.
This is not a real browser, Authentik, workerd, discovery, or JWKS verification test.
Node crypto compatibility with the deployed workerd runtime remains unverified.

Production architecture: use a maintained OIDC client to implement the protocol
adapter with a configured/pinned issuer and explicit asymmetric signing key,
strict callback URI, PKCE, state and nonce validation, algorithm allowlist,
issuer/audience/azp/time checks and bounded JWKS refresh. Do not follow JWKS URLs
from request headers. Protect token exchange and discovery with normal TLS
verification. Store sessions/transactions/credential ciphertext durably; `take`
must be atomic across all app instances. Isolate test hostname, cookie namespace,
provider/client, database and encryption secret from production.

Integration must call `requireMutation` before vault save/delete and expose only
configured status, never `resolveForProvider` to a browser. Current vault methods
are server-internal and do not themselves implement HTTP CSRF protection. All
model/chat/tool routes must obtain identity from the same session verifier and
resolve the key request-locally with no old cookie/body/shared-env fallback.
Use no-store for account responses; request/body/authorization logging must be
redacted. Session revocation and Authentik end-session/backchannel handling need
an explicit policy; this prototype only logs out its local session.

This branch contains prototype source and tests only, with no dependency or app
integration changes. No deployment, live credential read, or Authentik setting
change is included. Review and real runtime compatibility validation are required
before even a separate test deployment.

### Review corrections
The constant-time helper compares UTF-8 byte lengths before timingSafeEqual;
non-ASCII malformed CSRF input fails as Forbidden rather than RangeError.
The OIDC factory now requires an explicit `authorize({issuer, subject})` seam,
which must return exactly true. It is checked at login and on every session
lookup, so allowlist removal denies an existing session. The test allowlist is
only alice/bob fake identities; production must bind exact verified issuer/sub
pairs, never automatically allow every Authentik user. Exceptions fail closed.

`account-service.mjs` wraps save/remove with the mutation guard. This remains a
server-internal nonproduction facade; HTTP routing must map methods strictly,
limit body size, enforce JSON content type, set no-store, and never expose the
provider resolver. Direct vault access is not an authorized HTTP entry point.
Additional tests cover Unicode input, valid CSRF with wrong Origin, concurrent
callback replay, allowlist revocation and guard-before-write. Total: 75 tests.


## HTTP integration seam (experimental, not mounted)
`http.mjs` accepts injected auth and account services and returns a Fetch-style
handler. It is not imported by Bolt, not served by a listener and not deployed.
It adds explicit login/callback/session/logout and OpenAI configured/save/delete
routes, no-store responses, fixed error bodies and an 8 KiB streamed JSON limit.
Save authenticates and checks Origin/CSRF before consuming the credential body.
Only `{apiKey: string}` is accepted; caller user IDs cannot select an account.
There is no browser credential-read route or provider invocation here.

`http.test.mjs` uses a conspicuously fake x-test-user header adapter solely as a
unit-test fixture. It MUST NOT be copied into a live identity verifier. No real
browser/Authentik/client credentials or API provider is used. Tests cover
redaction, separate fake accounts, no-store, body validation/limits, method
restriction, unauthenticated/CSRF rejection and callback cookie preservation.
Actual app mounting, runtime validation, durable storage, logout policy, browser
UI and full OIDC+HTTP integration are still outstanding. These tests do not prove
production authentication or cross-browser persistence.


## Durable SQLite experiment (Node-only, fake data)
`sqlite-store.mjs` uses Node's built-in DatabaseSync and a server-owned database
path. Separate fixed namespaces hold transactions, sessions and encrypted
credential rows. Prepared statements prevent identifier interpolation. One
`DELETE ... RETURNING` statement consumes a login transaction atomically across
connections/processes. WAL, synchronous=FULL and a five-second busy timeout are
configured only on the test database, not on any live system.

Four tests use fresh temporary directories and delete only their own synthetic
files afterward. They verify a real writer-process exit followed by a fresh
reader-process decryption, eight-process contention with exactly one consumer,
namespace/overwrite/delete behavior, wrong-master-key rejection and second-user
isolation. No plaintext fake credential appears in the persisted main database.
The fake constant master key in sqlite-child.mjs is TEST DATA, not key management.

This proves the local Node adapter's basic persistence and transaction behavior,
not production durability under power loss or operational readiness. Sessions
and transactions contain sensitive runtime material and are not encrypted by
this adapter; production storage needs appropriate permissions, backup protection,
retention cleanup and a reviewed encryption/key lifecycle policy. Only the
credential payload is encrypted by the vault before insertion.

This adapter is NOT suitable for importing into the existing workerd app: local
node:sqlite/filesystem support has not been established there. Deployment would
require a separately reviewed Node server/service with durable volume or a
runtime-compatible database adapter. No service, volume, database or configuration
was created on the user's systems. Node24.22.1 was used locally; the deployed
Node22/workerd combination has not been validated.

Local negative runtime probe confirmed the limitation: workerd1.20260730.1,
compatibility2026-08-06, nodejs_compat allows importing node:sqlite but
`new DatabaseSync(':memory:')` throws `Illegal constructor`. This aligns with
Cloudflare documenting node:sqlite as a nonfunctional compatibility stub:
https://developers.cloudflare.com/workers/runtime-apis/nodejs/
No deployed runtime probe was performed. Node API reference:
https://nodejs.org/api/sqlite.html

`d1-store.mjs` is an alternative D1-style binding adapter using the same fixed
namespaces and atomic DELETE RETURNING. The isolated sibling lab d1-test.mjs
verifies it under local Miniflare/workerd with fake data and a temporary persisted
binding. It is not mounted in the app and does not create a remote D1 database.
Production persistence and lifecycle support in the Coolify-hosted preview runtime
remain unverified; local success is not permission or readiness to deploy.


## Server-only OpenAI provider boundary (not mounted)
`openai-boundary.mjs` is an isolated seam for later account-aware provider wiring.
It verifies the session, checks Origin/CSRF on generation, resolves only that
account's credential on every call, and supplies a fixed OpenAI base URL to an
injected trusted server driver. Caller credential/account/endpoint overrides are
rejected. No process-global provider/key cache, browser return of the resolved key,
or shared environment fallback exists in this seam.

Five fake-driver tests cover concurrent users, unauthenticated/missing-key denial,
caller override and wrong-origin denial, replacement/deletion without stale-key
cache, and method/prompt validation. There are no paid or real provider requests.
The fake driver records fake keys for assertions only; this is not production
logging. Production adapters must not log or reflect driver configuration.

This is not integrated with Bolt chat, streaming, tools or model-list routes.
The intentionally narrow model+prompt shape is a prototype contract, not a drop-in
replacement for Bolt's message protocol. A driver call already in flight cannot
be revoked retroactively by deleting a key; revocation affects subsequent calls.
Driver errors must pass through the fixed/redacted HTTP boundary, not be returned
raw. A production driver and actual application route integration remain to do.

Trusted-driver limitation: the boundary returns driver output unchanged. The
fake-driver test shows only that its chosen response contains no fake key; the
boundary does not sanitize arbitrary driver output. A production SDK adapter must
validate permitted response shapes and redact errors, and its transport must
independently enforce the fixed upstream, forbid redirects and reject shared-key
fallback. None of those production-driver behaviors has been proven here.


## Fixed-origin HTTP driver experiment
`openai-driver.mjs` narrows the trusted-driver gap for nonstreaming operations.
It accepts an explicit server transport, fixes requests to OpenAI's /models or
/chat/completions paths, rejects redirects, sets an abort deadline, bounds response
bytes, checks JSON content type, rejects direct credential reflection and exposes
only model IDs or generated text. Raw upstream bodies and transport errors are
never returned. No existing API key or real provider was used in tests.

Eight fake-response tests exercise fixed destination and request fields, output
schema, status/error/redirect rejection, malformed/oversized JSON, direct secret
reflection and invalid config. Actual network behavior is still untested. Transport
must honor Fetch redirect and AbortSignal semantics; a custom transport can violate
that contract. Credential reflection detection is defense-in-depth, not a general
secret-exfiltration detector. The prototype uses a fixed1024-token cap, no streaming,
tools, retries or arbitrary model settings, and is not mounted in Bolt.

## Node HTTP bridge (local-only experiment)
`node-http.mjs` bridges Node IncomingMessage to the reviewed Fetch handler. It
requires a server-configured HTTPS origin, validates Host/request target, strips
unverified forwarded and Authentik identity headers, preserves original Origin
for CSRF validation, and preserves separate Set-Cookie headers. The factory does
not listen automatically. Tests bind only an ephemeral127.0.0.1 port and close it.

Node receive/header timeouts are separate from the explicit handler deadline.
The bridge now aborts the Fetch request on handler deadline or client disconnect;
the provider boundary forwards that signal and the driver combines it with its
upstream deadline. Abort-aware local mocks verify propagation. Cancellation is
cooperative: ignored AbortSignals cannot forcibly stop arbitrary handler work.
The handler deadline ends when a Response is returned, not after its stream ends. TLS termination, reverse-proxy configuration/trust, rate limits,
real OIDC login and actual Bolt route mounting remain untested. This bridge is
not production-ready and no live listener, port or network setting was changed.


Cancellation regression tests confirm safe deadline errors and request abort on
client disconnect at a local loopback socket, plus caller cancellation reaching
the fake provider transport. No live upstream cancellation was tested. Responses
already returned as streams do not have a total stream lifetime deadline; that
and full production streaming behavior remain unresolved.


## Application assembly and settings UI experiment
`application.mjs` composes explicit server-owned protocol/storage/authorization/
master-key/provider dependencies into account HTTP handling plus an internal
provider capability. It starts no listener and reads no existing environment
credentials. `settings-client.mjs` includes a browser controller and a small DOM
mount function for connected status, password-input save and removal. Controller
state never contains the credential; the input is cleared immediately on submit.
JavaScript strings cannot be reliably erased from memory; no claim of secure
memory wiping is made. There is no localStorage/cookie credential persistence.

Five controller/assembly tests cover fake-controller behavior, duplicate request suppression,
fixed errors and controller-to-assembled-service isolation across fake Alice/Bob
sessions. They use synthetic Fetch requests, not actual browser cookies. Separate jsdom
tests exercise mounting, immediate input clearing, pending button state, connected
status and hostile-error text handling. Actual browser, cookie, TLS and
accessibility behavior still need validation; nothing is mounted in the live app. This UI is credential settings,
not account-persistent project storage.

Project migration is a distinct future capability: current project imports and
browser-local storage must not be assumed owner-isolated. An account workspace
import should preserve binary files and hashes, validate archive paths/limits,
bind ownership only to verified session identity, and remain inert until a user
explicitly chooses to run code. No migration or project execution is implemented.

The settings client rejects Fetch redirects and clears stale connected/CSRF state
after failures. These policies are asserted by fake tests, not real proxy tests.


## Dedicated Postgres/Supabase storage candidate
`postgres-store.mjs` implements the same repository contract against an injected
server-only Postgres client, using fixed private schema/table names and parameter
binding. It opens no connection and reads no credentials. Atomic take is a single
DELETE RETURNING statement. The SQL file is a draft migration only; nothing has
been applied to a database and it intentionally contains no role/grant changes.

Three query-contract tests verify bound parameters, fixed namespaces, one-statement
consume, missing rows and error propagation. They use a fake query client, not a
Postgres engine: SQL execution, actual concurrency, privileges, TLS, backup/restore
and connection-pool behavior remain unverified. No production-readiness claim.

A dedicated Bolt Supabase instance could host this private schema, while Authentik
continues to establish verified issuer/subject identities in the Node service.
Do not reuse the existing LV Computer Help production Supabase. Never give browser
clients or generated projects administrative/service-role credentials or access to
the account-control database. Supabase Auth identities/RLS must not be assumed to
match Authentik without an explicit verified mapping. Keep private tables out of
PostgREST exposure and review a least-privilege server role before deployment.
Workspace metadata/blobs and generated-app databases require separate designs;
this adapter currently covers only session, login transaction and credential rows.


A separate PGlite lab now executes this draft SQL against local PostgreSQL-WASM
rather than only a fake query client. It verifies JSONB/upsert/constraint/query
semantics and file-backed reopen with fake encrypted data. It remains single-user,
not server concurrency, real permissions or Supabase deployment validation.


## Inert project intake prototype

`inert-import.mjs` is a pure Node-only validation/snapshot seam, not a route,
archive extractor or persistent workspace. Five tests preserve binary bytes and
hashes, copy caller buffers, leave package scripts unchanged/unexecuted, and reject
traversal/ambiguous paths, case collisions, file-directory conflicts, special
Windows names, `.git`, unknown metadata including symlinks and client owner fields,
and count/per-file/aggregate limits. Paths must already be NFC; no silent renaming.
The returned bytes remain mutable server-internal data: persist/revalidate them
without handing the buffer to untrusted code. This is not a signed manifest.

Inputs are ordinary in-memory records with Uint8Array bytes, after a future trusted
parser. No ZIP decompression, ZIP-bomb protection, network/file extraction, malware
or secret scanning, archive metadata validation or actual migration is implemented.
Limits bound the resulting snapshot, not allocations already performed by a caller
or parser. Future parsing must enforce limits while streaming/decompressing and
reject symlinks before converting entries to this shape. The current allowlist is
conservative, not a portable filesystem-security guarantee.

There is deliberately no owner parameter: the future service must authenticate
and authorize a session, derive immutable issuer/subject ownership, and atomically
persist the manifest and bytes in that user's namespace. This pure module does not
prove ownership isolation. Imported files must remain inert until a separate,
explicit authorized execution step. Do not feed the result to existing Bolt ZIP
import/autostart paths. No browser storage migration or production imports occurred.

A separate isolated `oidc-library-lab/zip-intake.mjs` now prototypes bounded ZIP
parsing before this validator. Its safeguards and substantial production gates are
documented there; it is not integrated into any HTTP upload or live application.


## Owner-scoped immutable workspace seam

`workspaces.mjs` is a server-internal prototype, not an HTTP route or Bolt storage
replacement. Each create requires a mutation-authorized session; read resolves a
fresh verified identity. The namespace derives only from issuer/subject, never from
client owner fields or forwarded headers. Random server-generated IDs do not replace
ownership checks. Complete validated binary snapshots are stored as inert base64 +
SHA256 records through an injected atomic-create-if-absent repository contract.
The only supplied repository is a clone-on-read/write Map mock. Four tests cover
synthetic clients for one account, cross-user/issuer and header-forgery rejection,
revocation, mutation checks, validation before write, parallel owners and service
reconstruction. Reconstruction is not process restart or durable persistence.

No live accounts, project migration, listing/editing/deletion, browser autosave,
execution or workspace filesystem mounting are implemented. No byte quotas per
account, idempotency, resource accounting, database privileges, durable atomicity,
backup/restore or corrupted-store validation are demonstrated. The repository is a
trusted server-only capability; returned record bytes/metadata are not safe HTML or
trusted instructions. Base64 is not encryption; projects may contain secrets and
must remain private with storage encryption/access policy designed before deployment.
The real session adapter rechecks authorization; tests here use explicit mock auth.


## Unmounted upload boundary

`workspace-http.mjs` prototypes POST `/api/workspaces/import` as a Fetch handler.
It requires verified session and mutation/Origin/CSRF authorization before consuming
body bytes or invoking the injected archive parser. It bounds declared and streamed
upload size, cancels the reader on abort, returns fixed errors and no-store JSON,
and delegates to the service which rechecks authorization before write. Five tests
use fake auth/parser and memory storage; they prove no body consumption/parser/write
for rejected authorization, size/type rejection, inert binary snapshot, redacted
parser errors, mid-parse revocation and upload-wait cancellation.

This route is not mounted or connected to real auth, sockets or app imports. A
server bridge must supply trusted canonical origins, upload timeouts, rate limits,
concurrency/quotas and resource isolation. Parser work is not interrupted mid-parse
by this boundary; abort is checked before/after parsing, so a bounded cooperative
parser or isolated worker is still required. A parser failure writes nothing, but
DB permission/transaction/durability guarantees remain untested. No cross-browser
live account persistence is claimed by synthetic Request tests.

Authorization and cancellation checks occur before write, not atomically with the
storage commit. Revocation or abort racing an in-flight commit may still leave an
inert snapshot saved; production must define this behavior and audit/retry semantics.
