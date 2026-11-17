# Concrete separate Authentik test design (not applied)

## Proposed new objects

- Application: `Bolt Account Test`; slug: `bolt-account-test`.
- New OAuth2/OpenID Connect confidential provider: `Bolt Account Test OIDC`.
- Test origin proposal: `https://bolt-test.signallayerit.com`.
- One strict callback: `https://bolt-test.signallayerit.com/auth/oidc/callback`.
- Authorization Code with S256 PKCE; only `openid` requested by the app.
- Explicit asymmetric RS256 signing key selected in Authentik, never exported.
- Subject mode proposal: `user_uuid` for stable administrator-verifiable IDs.
  Apply only to this new provider, never existing Bolt/Sigint clients.
- Provider-specific issuer if supported by installed version; consume exact discovery
  `issuer`, token, authorization and JWKS URLs rather than constructing assumptions.
- Restrict application access to exactly the chosen two test users using new scoped
  bindings/group. Configure the service allowlist with their verified subject IDs.
  Names/email are not authorization keys. The identities have not yet been selected.

Authentik documents Code/PKCE support and provider-specific discovery/JWKS paths.
The API lists `user_uuid` among subject-mode choices. Verify labels/settings in the
installed2026.5.6 UI before acting; newer documentation is not proof every current
option exists there. Sources: [OIDC provider](https://docs.goauthentik.io/add-secure-apps/providers/oauth2/),
[provider API](https://api.goauthentik.io/reference/providers-oauth-2-create/).

## What this does not require

No forward-auth outpost, callback Traefik middleware or existing Sigint/Bolt provider
edit. Native OIDC callback is served by the new Node test application. No OpenAI key,
API call, refresh token/offline access, profile/email scope or production project.
No password copied into chat; user logins occur directly at Authentik.

## Required verified configuration before activation

1. Confirm exact two test identities and retrieve their nonsecret stable UUID/subject
   values from the admin UI/approved preview. Do not log or paste ID/access tokens.
2. Securely inject the separate client secret and runtime DB credential into only the
   test service. Do not reuse credentials from existing apps or export signing keys.
3. Read new provider discovery, verify HTTPS issuer/endpoints and supported RS256;
   copy verified metadata into configuration. Current adapter intentionally restricts
   those endpoints to the same origin. Stop on mismatch instead of weakening checks.
4. Read actual tunnel/Traefik topology and choose the exact new-host destination,
   Host/SNI settings and certificate validation. Do not assume previous host routing.
5. Obtain required action-time confirmation for the concrete security/routing changes
   with those exact details. The generic test approval is not permission to weaken
   existing controls or expose database ports.

## Narrow confirmation proposal to complete after read-only inventory

Create only the new Bolt Account Test OIDC application/provider, with the exact
callback above and access restricted to [verified test user1] and [verified test
user2]. Add only the new `bolt-test.signallayerit.com` route to [verified private test
service/proxy destination], preserving certificate validation and using [verified
Host/SNI]. Keep live Bolt, Sigint, LV database, shared outposts and other routes
unchanged. Do not issue this proposal until bracketed details are actually verified.

## Browser acceptance / revocation

Use separate browser profiles for the two users, upload their distinct generated
fixtures, record snapshot IDs, logout/login and reconstruct test services. Each must
recover only their own binary data; cross-owner ID requests must fail. Denied third
user, anonymous upload and bad CSRF must fail before parsing. Never execute fixtures.

Local app sessions last up to1hour. Authentik-only account disable does not instantly
invalidate an existing app session; back-channel logout is not implemented. Test
local revocation by changing the test allowlist/restarting only the test app, then
verify the retained cookie is denied. This limitation blocks a production-ready
claim and must be resolved or consciously designed before real-account rollout.
