# Isolated build / real PostgreSQL verification plan

Not executed. Coordinate slit-cool-02 capacity/other workers first. Use the exact
reviewed experimental commit, a fresh test-only working directory, and official
Docker images. These tests need no DNS, Authentik changes, real keys or user data.
Do not use a running production container, database or volume.

1. Fetch/read-verify reviewed branch source into a new test working directory.
2. `docker build -f experiments/account-test-service/Dockerfile -t bolt-account-test:REVIEWED_SHA .`
3. Run that image with `--network none --rm` and no secrets/config. Expected: fixed
   startup error/exit1, proving imports resolve without trying real services.
4. Create a uniquely named disposable `postgres:17-bookworm` container with
   `--network none`, no published ports, `--cpus 1 --memory 1g`, a fake test password,
   and disposable test-only data. Preserve generated test evidence before cleanup.
5. Wait for `pg_isready` via `docker exec`. Through stdin `psql` as disposable admin,
   apply `postgres-schema.sql`, `workspace-schema.sql` and `real-postgres-check.sql`.
   Verify output ends with `two_snapshots_preserved = t`; errors stop execution.
6. In a separate internal loopback psql connection authenticate as the restricted
   runtime test user, verify basic SELECT/INSERT and expected denied UPDATE/DELETE
   on workspace tables. This verifies login behavior distinct from SET ROLE.
7. Restart only this disposable Postgres container (if using test-only persistent
   data), then verify both fake binary rows remain and role privileges still apply.
8. Remove only exact test containers/volumes once evidence is preserved. No broad
   `docker prune`/wildcard cleanup. Do not alter production Docker/daemon settings.

The SQL script deliberately demonstrates privilege separation, not database-enforced
per-user row isolation: the runtime service can query all owner rows, and every
application read must bind the verified owner. It cannot administer the database or
modify/delete immutable workspace records. This is not a durability/crash test.

A combined real Node+Postgres test requires an explicit private-network plan and
secure real test configuration. Do not attach the test to existing production
networks casually. Public hostname/proxy/TLS and separate real Authentik client
configuration remain concrete security-sensitive changes to confirm before acting.


## Additional candidate no-external-network bootstrap check

After SCRAM-authenticated disposable PG tests, an additional Node container may share
only that disposable container's network namespace (`--network container:TEST_PG`),
where TEST_PG itself uses `--network none` and no ports. This is a candidate test, not
an executed claim. Inject only fake OIDC configuration/two fake subjects and the fake
restricted test DB login; do not connect real IdP metadata or secrets. Use the explicit
approved-private-test-network DB mode for this fully isolated loopback hop.

Via `docker exec` inside the Node container, a small Node fetch check with canonical
Host can verify health, anonymous session/list/upload denial and invalid callback
rejection. Do not follow the fake authorization redirect or contact any external IdP.
This verifies valid bootstrap and actual pg driver connectivity, not real login/TLS.
No container should be attached to an existing production network or published port.

The candidate includes `isolated-probe.mjs` for step above. Configure ONLY the
network-none fake test with `TEST_ORIGIN=https://bolt-test.invalid`. Run the probe
inside that test Node container: `node experiments/account-test-service/isolated-probe.mjs`.
It contacts only `127.0.0.1:3000`, uses the fake canonical Host, never follows
redirects, cancels unread bodies, and prints check labels/status codes only. It
checks health, anonymous denial, invalid callback, and disabled AI-key routes.
It does not start login, create sessions/projects, contact the IdP, or test actual
user authentication. Do not use it against a real configured application. Unit
tests use a mocked transport; native container results must be separately captured.
