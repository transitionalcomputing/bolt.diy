# Separate test activation proposal — not executed

## Verified prerequisites and remaining uncertainty

The execution worker observed the target02 proxy has a `letsencrypt` ACME resolver
using Cloudflare DNS challenge and `/traefik/acme.json`. No credential value/scope
was read. A validated local request for the proposed hostname failed with curl60:
Traefik served its self-signed default certificate, not a matching hostname cert.
The tunnel has no test-host route. Existing live applications remain unchanged.
Two existing active user accounts were identified privately; do not create users or
include their identifiers in this public plan. A public RSA signing-key metadata
entry exists in Authentik; new-provider binding and subject mode remain to verify.

## Proposed bounded changes requiring applicable action-time approval

1. Create only the separate test application and database on02, with resource caps
   from the candidate manifest. Keep the database on a dedicated internal backend
   network with no published ports. For proxy access, use a new dedicated frontend
   bridge containing only this app and the existing02 proxy; adding the proxy to
   that network must be explicitly approved. Do not attach the app to other apps'
   private networks or reuse production data/credentials.
2. Add one exact-host router for `bolt-test.signallayerit.com` to the02 proxy:
   HTTPS entrypoint, TLS enabled, existing `letsencrypt` resolver, backend HTTP port
   3000 on that dedicated frontend. No wildcard router or public port3000. The
   resolver may create temporary DNS-01 TXT records for this exact hostname; no
   new DNS token or certificate-store export is needed or authorized by this plan.
3. Wait for observed issuance. Repeat local validated curl with hostname resolution
   to02 loopback and inspect public SAN/expiry. Do not disable TLS checks or install
   a broad trust exception. Existing resolver credentials might fail; stop and
   report the exact redacted error, not assume issuance succeeded.
4. Only after matching trusted-certificate proof, add the new tunnel hostname with
   origin `https://slit-cool-02.internal.signallayerit.com:443`, Origin Server Name
   and HTTP Host Header `bolt-test.signallayerit.com`. Keep No TLS Verify OFF.
   Verify reachability/certificate from the actual connector path, not just local
   proxy loopback. Existing routes and outposts remain unchanged.

## Separate identity and secret provisioning

Create a new confidential OIDC application/provider only for this test; exact strict
callback `https://bolt-test.signallayerit.com/auth/oidc/callback`, Code+S256 PKCE,
openid scope, verified RS256 signing key and stable subject mode. Bind only the two
privately verified existing users, ANY binding mode, and configure the service's
matching two-subject allowlist. Do not alter live Bolt's single-user binding.
Verify available `user_uuid` and signing algorithm in the new-provider flow before
saving; never export the signing private key. Retain default authentication controls.

Privately provision a new client secret, restricted database login and fresh32-byte
test vault encryption key into only the test resource; do not print or commit them.
Use synthetic credential mode with alpha/beta fixture selection only. Do not ask
participants for OpenAI keys, impersonate the second person or change their login.
Actual second-person participation is needed for real two-account acceptance.

Readiness probes must preserve the configured canonical Host. Node fetch did not
preserve a manually supplied Host in the native383 test; use the reviewed native
HTTP probe pattern. A generic localhost HTTP healthcheck without canonical Host
will be rejected correctly. Configure any container healthcheck accordingly.

## Rollback and verification

Before changes, record the exact new resource/router/network identifiers and current
working proxy/tunnel state without credentials. On failure remove only the new test
tunnel route and router, detach only the newly added frontend network attachment,
and stop the new app. Preserve fake-data evidence/dump and required encryption key
before deleting its exact database/volumes. Do not prune Docker, reset the proxy,
delete existing certificate-store entries, revoke shared tokens, or alter live
Bolt/Sigint/LV services. Verify the pre-existing services remain healthy.

This is a proposal, not authorization or proof of successful deployment. Network,
DNS/certificate issuance and routing changes require the applicable concrete
confirmation. OIDC setup preapproval does not waive those security requirements.

Proxy network membership must have an explicit persistence/rollback plan in the
supported deployment configuration. A manual runtime attachment is temporary and
may disappear on proxy recreation. Do not silently edit/restart the shared proxy
configuration to make it permanent; if that is required, disclose the possible
brief impact to existing routes and obtain the corresponding concrete approval.
