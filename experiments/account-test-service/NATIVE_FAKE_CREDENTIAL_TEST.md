# Native synthetic-credential persistence candidate (not executed)

Build the exact reviewed revision containing `isolated-credential-probe.mjs`; do
not count older383 tests as this feature's validation. Use only a new disposable
SCRAM PostgreSQL instance, network none/no ports, bounded resources and reviewed
schema/runtime-role setup. Share only that namespace with the candidate Node image.

Configure the existing fake origin/issuer/client/subjects/runtimeDB values from
NEXT_REMOTE_TEST.md. Additionally set TEST_FAKE_CREDENTIALS=enabled and privately
provision one fresh32-byte canonical-base64 TEST_FAKE_VAULT_KEY for this fake-data
run. Retain the same key for the run's restart checks; never print it in evidence,
copy a production key, or commit an environment file. Synthetic alpha/beta values
are not actual OpenAI credentials, and the probe makes no IdP/provider requests.

Run inside a bounded Node process:
`node experiments/account-test-service/isolated-credential-probe.mjs seed`
Then exit/restart the Node test container and restart only the disposable PG,
retaining its test volume and test encryption key. Run the `verify` phase in a new
Node process. Finally run `remove`; it verifies Alice removal leaves Bob before
removing Bob. Require exit0 and the fixed passed record for each phase.

The probe requires fixed fake origin/issuer/subjects and loopback restricted DB
login, uses real pg driver/store/encrypted vault, but deliberately mocks identity.
It does not validate OIDC, browser cookies, CSRF or network security. Those gates
need the separate real two-person acceptance test. Process15second deadline and
3second DB timeouts bound normal waits, not kernel/event-loop faults. No background
service, published port or external connection is required. Preserve evidence,
then remove exact disposable containers/volumes and private fake-run key file.
