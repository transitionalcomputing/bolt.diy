# Isolated test checkpoint

## Source versions

- Image and real PostgreSQL tests below used **af5c0a647e34c7dcae31168ab974742fa3e62f03**.
- Auth-hardening source checkpoint: **c3285e955c4c73685f5a7dffe69429c1cebcf56f** (auth expiry/CSRF
  fail-closed checks and explicit test allowlist reconstruction).
- That checkpoint had115 passing offline tests; its image was **not** rebuilt/tested.
- Subsequent reviewed integrity/fixture source: **016550991f26021b29f207f58cae23fda76c3f0b**,120 offline tests; no remote image result for this revision yet.
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

## Completed follow-through (reported by coordinated execution worker)

The supported connection was restored. The SCRAM instance was restarted and an
actual restricted-password login again verified two rows and AP8= binary retained.
The exact two test containers and their two anonymous volumes were removed with
exit0; six pre-existing services remained healthy. The old af5c0a image remains
cached, not running. Dump/log evidence remains in the unique temporary test folder;
it has not been claimed as a long-term backup or copied into this public repository.

Latest reviewed source is **383a3adefbb24f11ca7d949a39a4af92c528a937** with127 local
passing tests. It includes bounded listener lifecycle and a fake-only native
readiness probe; it has not yet been remotely rebuilt or deployed. Build this exact
candidate for the next isolated test, not the cached af5c0a image.

Real Authentik/DNS/TLS test provisioning still requires exact verified configuration
and applicable action-time approval. Browser ownership must be handed off explicitly.

## Native383 candidate check (execution-worker report)

The rebuilt383a3ade image and no-config fail-closed check passed. A fresh isolated
SCRAM PG plus valid fake-config Node bootstrap reached the listening state. The
original fetch-based probe returned400 on all paths: locally reproduced Node24
fetch silently replaced the requested canonical Host with loopback host/port.
This was a probe defect, not a reason to weaken the server's Host validation.
The worker reran with native node:http and canonical Host; all6 expected statuses
passed (200,401,401,401,400,404) without changing bridge/configuration. Signal/restart
and cleanup results are recorded separately once verified. New native transport
probe correction is locally regression-tested with a real loopback listener.

Follow-through for the383 run: the worker reported native checks passed before and
after TERM/stop/start; stopped state was exited with code0. Exact Node/PG test
containers and their anonymous volume were removed with exit0; six existing
services remained healthy. Nonsecret status logs and the fake database dump remain
in the unique383 temporary test directory. The Mac UI was released for coordinated
read-only Authentik inventory. These are execution-worker observations, not new
local native results or proof of real identity/browser acceptance.
