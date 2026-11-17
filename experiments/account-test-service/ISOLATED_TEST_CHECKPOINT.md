# Isolated test checkpoint

## Source versions

- Image and real PostgreSQL tests below used **af5c0a647e34c7dcae31168ab974742fa3e62f03**.
- Latest reviewed source is **c3285e955c4c73685f5a7dffe69429c1cebcf56f** (auth expiry/CSRF
  fail-closed checks and explicit test allowlist reconstruction).
- Latest source has115 passing offline tests; its image has **not** been rebuilt/tested.
- Production main remains **efb34d0f1e1e4d224ff133f0ca28fecc343066a6**. No deployment.

## Reported execution evidence

The coordinated browser worker observed these outcomes on slit-cool-02 and retained
logs in the uniquely named temporary test directory. These are completed outcomes,
not merely an accepted handoff or active-worker label:

1. Dedicated Docker image build: exit0.
2. Image run with no config/secrets and `--network none`: expected exit1 and fixed
   startup error, proving imports resolve and missing configuration fails closed.
3. Disposable PostgreSQL17, network none, no published ports,1CPU/1GiB: schema and
   role/check SQL exit0, two snapshots preserved=true.
4. Original disposable DB clean restart: both fake rows, AP8= binary bytes and
   restricted runtime grants persisted.
5. Initial default loopback auth was trust. It was **not** counted as password proof.
6. Separate fresh disposable DB initialized for SCRAM host authentication: wrong
   runtime password exit2, correct runtime password exit0; SELECT and transactional
   INSERT permitted, workspace UPDATE/DELETE denied, original two rows unchanged.

No real Authentik login, valid-config Node/database bootstrap, browser persistence,
public route, project migration or production change occurred. These results do not
prove crash recovery, RLS tenant isolation, image vulnerability clearance or TLS.

## Interruption and required follow-through

The Mac/browser connection became unavailable before restart of the SCRAM test
instance and cleanup. Two bounded network-none containers remain:
`bolt-account-pg-af5c0a` and `bolt-account-pg-scram-af5c0a`.
Do not claim them removed. Preserve/read-verify the retained test logs in an approved
project evidence location before removing the exact disposable resources. Never use
broad prune or touch existing production containers/volumes.

Once the supported connection is restored, first inspect actual container/state and
preserve evidence, then complete exact cleanup. Rebuild latest c3285e9 before any new
valid-bootstrap test. A next optional isolated test can share the disposable PG's
network-none namespace with Node using fake configuration only; it must not expose
ports or attach to production networks. Real Authentik/DNS/TLS test provisioning
still requires concrete configuration review and applicable action-time approval.
