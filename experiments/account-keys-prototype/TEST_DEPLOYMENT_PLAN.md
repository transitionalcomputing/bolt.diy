# Dedicated account/workspace test environment (not deployed)

## Scope and readiness

Candidate: **slit-cool-02**. Proposed hostname **bolt-test.signallayerit.com** is a
placeholder, not an existing DNS/routing assertion. Keep live Bolt and the LV
Computer Help database untouched. This is a separate account/workspace test harness,
not a replacement Bolt editor. Use generated fake projects and no OpenAI keys/calls.

Current tests compose signed synthetic OIDC/PKCE, session+CSRF, bounded ZIP upload,
owner-scoped service and disk-backed PGlite workspace persistence. The IdP transport
is fake; actual Authentik, browser cookies, reverse proxy and PostgreSQL server roles
have not been validated. Required runnable bootstrap, browser navigation/listing and
real server adapter tests are not yet deployment-ready. Do not deploy lab test scripts.

## Proposed isolated services

- Node24 account/workspace harness, unprivileged UID, read-only root filesystem with
  temporary scratch, no Docker socket/host mounts, no automatic project execution.
- Dedicated PostgreSQL instance/volume, not full Supabase and not any existing DB.
  No public published DB port. Private service network only.
- Separate migration owner and runtime DB role. Runtime gets only necessary access
  to private account/session/workspace tables, no role/schema/database creation.
  Do not expose these tables through PostgREST or browser database clients.
- Conservative initial Node allocation: 1 vCPU and 1 GiB RAM; Postgres 1 vCPU and
  1 GiB RAM plus bounded persistent volume. Estimates, not load-test evidence.
  Uploads maximum32MiB, one import at a time initially; storage quota/retention and
  request-rate limits required before exposing even the test harness.

## Authentik plan requiring specific configuration approval

Create a **new** confidential OIDC provider/application for this test harness; do
not edit the working Bolt/Sigint providers or shared outpost configuration. Use
Authorization Code + S256 PKCE, explicit asymmetric signing key, and exact redirect:
`https://bolt-test.signallayerit.com/auth/oidc/callback` (no wildcard). Resolve actual
issuer, authorization/token/JWKS endpoints from that provider, not guessed paths.
Limit application access to the explicitly selected two test users. Application
allowlist must also check verified issuer/subject, never name/email/header claims.

Store client secret through the approved private secret-injection path, never chat,
repository or browser bundle. Do not reuse another app's secret or signing key
material. A new opaque session cookie is host-only Secure/HttpOnly/SameSite=Lax;
Origin+CSRF checks cover writes. Local logout removes one session only; do not claim
IdP/global logout or instant atomic revocation of in-flight writes.

## Proxy and network changes requiring concrete confirmation

Before acting, inventory the existing route/connector location and destination.
Propose the exact new hostname route and private test-service destination, TLS/SNI
verification and trusted proxy boundary for action-time approval. Do not disable
certificate checking, trust arbitrary forwarded identity headers, expose a Docker
API/database port or add a broad firewall exception. Browser-to-service must be
HTTPS; any internal HTTP hop requires an explicitly reviewed private-network trust
boundary. Existing cloud tunnel/Traefik topology is not assumed from old logs.

## Secrets and data

Dedicated random DB credentials and session/vault configuration must be provisioned
securely only when the test service bootstrap is ready. No values are part of this
plan. The key-vault API should be disabled for this workspace-only test; no real AI
key is needed. Project snapshots are base64 JSON, not encrypted by that encoding.
Review volume encryption/backups/retention and never upload real user projects until
approved. Auth transaction/session records contain sensitive token material too.

## Acceptance and rollback

1. Validate nonproduction compose/bootstrap offline and independently review.
2. Obtain exact security/routing configuration approval, provision separate resources.
3. Verify health, TLS, host enforcement, no public database exposure and auth denial.
4. Two separate browsers/accounts log in through real Authentik; each uploads a tiny
   generated ZIP with distinct text/binary files. Never run imported code.
5. Log out, sign back in, restart only the test app/database cleanly, confirm each
   owner's files remain and guessing the other's ID gives no access.
6. Test invalid ZIP, unauthenticated upload, CSRF, expired session and revoked access.
7. Document actual evidence, limitations and remaining production gates.

Rollback removes/disables only the newly created test route/provider/services after
preserving authorized test evidence and checking recovery requirements. Never delete
live project data, reset shared Authentik or restart the production proxy casually.
