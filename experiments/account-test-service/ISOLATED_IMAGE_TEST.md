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
