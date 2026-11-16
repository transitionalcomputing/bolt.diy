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
jose6.2.17. Twelve library/integration tests pass: valid signed RS256 identity, rejection of
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

To test the orchestration suite too, run `node --test ../account-keys-prototype/*.test.mjs` from this directory (34 tests). Neither suite makes real provider requests.

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

PKCE limitation: the fake identity provider does not compare the authorization
code challenge with the submitted verifier. These tests exercise the client's
PKCE parameter plumbing, not complete end-to-end PKCE enforcement by an IdP.
