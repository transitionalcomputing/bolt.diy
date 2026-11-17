# Exact separate test staging runbook

This manifest is intended only for the explicitly approved test on02. It is not a
production migration. Before use, independent review, native init validation and
current host/service baseline must pass. Never improvise changes to shared proxy,
Docker daemon, live applications, existing networks, credentials or certificate store.

## Artifact and configuration ownership

Use `compose.staged.yaml`, not compose.example.yaml. Build the exact reviewed source
image and record its immutable image ID. Set BOLT_TEST_IMAGE to that local tag and
BOLT_TEST_PRIVATE_DIR to a new private directory outside the source checkout.
The manifest fixes unique test container/network/volume/router names. Check all are
absent before first creation; stop on any unexpected collision. No existing volume
may be adopted. Do not overwrite an existing deployment's private configuration.

The Authentik provisioner supplies a mode0600 private JSON file containing exactly:
`metadata`, `clientId`, `clientSecret`, `subjects`. Metadata comes from the new
provider's verified discovery; subjects are the two privately verified stable IDs.
No values enter chat/public source. Run `provision-private-config.mjs INPUT OUTDIR`
on the server using the candidate Node image or approved Node runtime, without a
TTY or shell tracing. It creates OUTDIR0700/app.env0600/database.env0600, generates
separate random admin/runtime passwords and a fresh32-byte vault key, and prints
only a fixed success/failure sentence. Reject existing OUTDIR. A failed partial
write is retained for inspection, not auto-deleted/reused. Preserve these secrets
privately for restart/backup; rerunning is not a key-rotation mechanism.

Compose env_file uses `format: raw` (requires Compose2.30+), preserving literal dollar
signs and quotes without interpolation. Verify installed support with `config -q`;
never print resolved Compose configuration or container environments. Source:
https://docs.docker.com/reference/compose-file/services/#env_file

## Native validation before staged startup

First use fresh disposable network-none PostgreSQL with fake-only input config and
these same initialization mounts. Verify init exit success, actual SCRAM runtime
password login, correct narrow grants and denied workspace UPDATE/DELETE. The role
initializer uses psql `\password` with stdin/no TTY so plaintext passwords do not
enter SQL/history/server logs; no logging configuration is disabled. Source:
https://www.postgresql.org/docs/17/app-psql.html
Do not promote a partially initialized volume or assume shell syntax validation
proves native psql prompt behavior. Retain nonsecret results and exact cleanup.

## Staged changes and safety checks

1. Capture current02 load/free memory/free disk and exact pre-existing container
   IDs, health and proxy network membership. Pause on degradation/capacity pressure.
2. With private real test OIDC config ready, validate the manifest quietly. Start
   only this Compose project. Starting the labeled app is already a material
   router/certificate change: the Docker provider may discover labels and request
   the certificate before proxy network attachment. This is within the explicit
   test-only router/certificate approval, not an unapproved preflight. App and DB
   each cap1CPU/1GiB/128PIDs; bounded logs;
   app unprivileged/read-only/dropcaps. DB initializes only a new named volume,
   with SCRAM host auth and restricted runtime role. No host ports are published.
3. Observe DB initialization and app health with only fixed/error-redacted output.
   Healthcheck uses native HTTP with canonical Host. Require healthy before proxy
   attachment. Recheck pre-existing services. Stop/report on unexpected errors;
   do not repeatedly restart or recreate database volumes to hide failures.
4. Add only the existing02 proxy to `bolt-account-test-front` at runtime, after
   checking exact network membership. No shared proxy restart or static config edit.
   This authorized temporary attachment is not guaranteed across proxy recreation.
   The dedicated router may already have requested the exact-host certificate via
   existing DNS01 when its container appeared; this attachment provides the
   explicitly scoped backend reachability.
5. Validate actual trusted matching certificate locally. Only then add the approved
   tunnel hostname to HTTPS02:443 with Host/SNIbolt-test.signallayerit.com and TLS
   verification enabled. Stop on issuance/reachability failure. Existing routes
   remain unchanged. Check existing services after each material step.
6. Test real users separately: each logs in directly to Authentik, chooses a different
   fake fixture, imports a different inert ZIP, signs out/in, and recovers only their
   own data. No real API keys, provider requests or imported-code execution. Native
   app+DB restart and browser persistence are separate acceptance evidence.

## Rollback

Stop only the test app first if safety is uncertain. Remove only the new tunnel
route, then the test app/router. Disconnect only the02 proxy's new test-front
attachment. Preserve private key/config and fake DB dump before any database/volume
removal; do not run `down -v` casually. A normal Compose down may fail removing the
front network until the proxy is detached. Never broad-prune or touch existing
proxy certificate entries/tokens. Record exact resource IDs and verify existing
services remain healthy. Keep all secrets out of evidence logs.

### Bounded private generator invocation

After a provisioner has created a new root-owned0700
`/data/bolt-account-test-secrets` containing only the mode0600 `oidc-input.json`,
run the reviewed image with no network, no Docker socket, read-only root and only
these narrow mounts (replace IMAGE with the recorded reviewed image identifier):

```sh
docker run --rm --network none --read-only --user 0:0 \
  --cap-drop ALL --security-opt no-new-privileges:true \
  --cpus 1 --memory 128m --pids-limit 32 \
  --mount type=bind,src=/data/bolt-account-test-secrets/oidc-input.json,dst=/run/input.json,readonly \
  --mount type=bind,src=/data/bolt-account-test-secrets,dst=/run/private-parent \
  IMAGE node experiments/account-test-service/provision-private-config.mjs \
  /run/input.json /run/private-parent/current
```

The container's root identity here is limited to this no-network config-writing
invocation, not the running app. It creates host-root-owned private files. Stop if
`current` already exists; do not regenerate credentials or overwrite an active
vault. The manifest then uses BOLT_TEST_PRIVATE_DIR=/data/bolt-account-test-secrets/current.

The healthcheck socket has a3second idle timeout; the manifest supplies the overall
5second process timeout. Neither implies successful real browser authentication.

### Preserve shared proxy default route

Before attaching the new frontend, inspect the proxy's existing selected default
route and gateway priorities. Docker's highest `gw-priority` selects the gateway;
verify CLI support and set the new attachment strictly lower than the current
selected priority (for example -1 only when the current selection is greater).
Do not change existing endpoint priorities. Compare the default route afterward
and detach only the new endpoint if it changed unexpectedly. Equal-priority blind
attachment is not acceptable on the shared production proxy. Source:
https://docs.docker.com/reference/cli/docker/network/connect/

If CLI support or current priority cannot be established, stop and report; do not
fall back to equal-priority attachment.
