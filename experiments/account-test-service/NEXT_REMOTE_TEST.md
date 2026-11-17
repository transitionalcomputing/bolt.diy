# Next native test handoff (not executed)

Source: **383a3adefbb24f11ca7d949a39a4af92c528a937**. Prior build/PG evidence applies
only to af5c0a, whose disposable containers/volumes are now reported removed.
Coordinate Chrome ownership and check slit-cool-02 capacity before starting.
Use a fresh test-only directory and preserve full nonsecret logs there.

1. Fetch the pinned source and verify commit/readback. Build with existing Dockerfile
   to `bolt-account-test:383a3ade`. No production deployment or existing volume reuse.
2. No-config run, network none, expects fixed startup error/exit1.
3. Create a fresh uniquely named PG17 container, network none, no ports,1CPU/1GiB,
   using fake test admin password and explicit host SCRAM initialization. Retain the
   exact container and volume identifiers. Apply both reviewed schemas and role SQL
   with ON_ERROR_STOP. Verify restricted runtime password login.
4. Start separate Node candidate with1CPU/1GiB, usernode, read-only root and tmpfs /tmp,
   no published ports, only `--network container:EXACT_DISPOSABLE_PG_NAME`.
   The PG container must still have network none. No existing network attachment.
5. Fake-only configuration:
   - TEST_ORIGIN=https://bolt-test.invalid
   - issuer=https://fake-idp.invalid; authorization endpoint /authorize; token /token;
     jwks /jwks; metadata supports code, RS256 and client_secret_post.
   - fake client ID/secret and exactly ["fake-alice","fake-bob"] subjects.
   - DATABASE_URL restricted fake runtime user,127.0.0.1:5432/test DB.
   - DATABASE_TLS=approved-private-test-network (only this isolated loopback test).
6. Wait for fixed listening message. Inside Node container execute
   `node experiments/account-test-service/isolated-probe.mjs`.
   Require all6 expected statuses; don't follow login or external endpoints.
   Capture bounded container logs, no environment dumps.
7. Send TERM only to this Node candidate with15second stop timeout. Record exit and
   restart the same candidate with its fake config; rerun probe. This checks lifecycle
   and native pg connectivity, not OIDC login, browser cookies or project recovery.
8. Retain evidence, remove only exact new Node/PG containers and associated test-only
   anonymous volumes. Verify pre-existing services unaffected. No broad prune.

The fake-only credential seam under development is not in this pinned candidate's
bootstrap. Its AI-key route intentionally remains404. No actual user/API keys or
existing production database are needed for this test. A later separately reviewed
candidate will test synthetic credential selection with encrypted persistence.
