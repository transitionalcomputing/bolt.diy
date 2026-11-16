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
jose6.2.17. Eleven library tests pass: valid signed RS256 identity, rejection of
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

To test the orchestration suite too, run `node --test ../account-keys-prototype/*.test.mjs` from this directory (30 tests). Neither suite makes real provider requests.
