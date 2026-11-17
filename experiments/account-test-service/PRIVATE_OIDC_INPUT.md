# Private OIDC input assembly

The provider/application already reported created must be read back before use.
The initializer consumes a `metadata` JSON object, not a discovery URL. Public
metadata can be fetched on the authorized host with ordinary HTTPS validation,
a bounded timeout and no redirects/TLS bypass. Do not use a discovery failure as
permission to weaken transport controls. The known discovery URL is:
https://auth.signallayerit.com/application/o/bolt-account-test/.well-known/openid-configuration

Verify the exact issuer is:
https://auth.signallayerit.com/application/o/bolt-account-test/

For subject mode User's UUID, use the actual `uuid` of each privately verified user,
not numeric `pk` and not hashed `uid`. Official2026.5.6 source maps that mode to
`str(user.uuid)`; the admin user serializer includes this field. Prefer the existing
user detail UI; if supported, a narrowly scoped read of the specific user's admin
API response can identify this nonsecret field. Never impersonate either user,
create a new token, export users, or log unrelated profile data to obtain it.
Sources:
https://github.com/goauthentik/authentik/blob/version/2026.5.6/authentik/providers/oauth2/id_token.py
https://github.com/goauthentik/authentik/blob/version/2026.5.6/authentik/core/api/users.py

## No-echo transfer

Only after supported Mac/Coolify session recovery and explicit ownership handoff:

1. Create the new root-owned0700 `/data/bolt-account-test-secrets` directory if
   absent. Stop if it contains unexpected existing configuration.
2. Assemble mode0600 `oidc-base.json` privately with exactly `metadata` (the verified
   object), `clientId` (new provider's public ID), and `subjects` (two verified UUID
   strings). These identities must not be committed to the public repository.
3. In the authorized02 terminal, run the reviewed helper without a heredoc or pipe:
   `python3 PATH/receive-oidc-input.py /data/bolt-account-test-secrets/oidc-base.json /data/bolt-account-test-secrets/oidc-input.json`
4. At its hidden secret prompt, use the supported UI copy operation on only the new
   test provider's masked secret, then paste into that no-echo prompt and Enter.
   Never paste into a normal echoed command or use a screenshot that reveals it.
   Clear the clipboard after transfer. If supported copy/paste or realTTY/no-echo
   operation is unavailable, stop and report that specific blocker.
5. Require the fixed success sentence, mode0600 and exact output file existence;
   do not print its contents. The helper refuses non-TTY input, getpass fallback,
   malformed UUID/issuer, symlink input, permissive file modes and overwrites.
6. Run the separate reviewed private-config generator from the staging runbook.

The helper creates only the private input file; it makes no network requests,
changes no identity/security settings, and does not deploy anything. Failed partial
writes are retained, not silently overwritten. Python mode/shape tests are local;
actual no-echo terminal transfer must still be observed via safe status only.

Local tests also exercise a real PTY with a fake secret and verify no echo. This is
not proof of the remote browser clipboard/terminal path. The helper assumes trusted
root-owned directory ancestors; it is not a sandbox against malicious ancestor
replacement. UUID shape validation is not identity verification: verify each user's
actual UUID administratively before assembling the private base file.

## Browser diagnostic boundary

A masked password input is not a redaction boundary for automation tools. Locator
ambiguity/errors can include underlying input values. Do not inspect, enumerate,
or resolve the secret field through a locator that can return its DOM/value in
diagnostics. If a supported no-output copy operation cannot be established, use a
human handoff: the owner rotates only the new test client's secret, copies the
replacement directly into the helper's hidden TTY prompt, then clears clipboard.
Never send the replacement in chat or paste it into an echoed shell command.

If a client secret appears in a diagnostic, stop using it immediately. Rotate that
client secret before any deployment; do not treat an absent host input file as
proof the exposed value remains safe. Rotation must be verified through safe
status only, without comparing or printing old/new secret values. Preserve the
client identity, callback, scope, signing and access bindings unchanged.
