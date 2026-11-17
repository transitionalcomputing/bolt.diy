-- Disposable empty test DB only. Execute as test postgres admin, never live/LV.
-- Fixed values below are deliberately fake and are not deployment credentials.
\set ON_ERROR_STOP on
CREATE ROLE bolt_test_runtime LOGIN PASSWORD 'fake-disposable-test-password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
GRANT USAGE ON SCHEMA bolt_private TO bolt_test_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON bolt_private.records TO bolt_test_runtime;
GRANT SELECT,INSERT ON bolt_private.workspace_snapshots TO bolt_test_runtime;
SET ROLE bolt_test_runtime;
INSERT INTO bolt_private.workspace_snapshots(owner_id,id,payload) VALUES
 ('fake-alice','11111111-1111-4111-8111-111111111111','{"id":"11111111-1111-4111-8111-111111111111","mode":"inert","files":[{"path":"a.bin","base64":"AP8="}],"totalBytes":2}'),
 ('fake-bob','22222222-2222-4222-8222-222222222222','{"id":"22222222-2222-4222-8222-222222222222","mode":"inert","files":[],"totalBytes":0}');
DO $$ BEGIN
 IF (SELECT count(*) FROM bolt_private.workspace_snapshots WHERE owner_id='fake-alice' AND id='22222222-2222-4222-8222-222222222222')<>0 THEN RAISE EXCEPTION 'owner predicate failed'; END IF;
 BEGIN
  INSERT INTO bolt_private.workspace_snapshots SELECT * FROM bolt_private.workspace_snapshots WHERE owner_id='fake-alice';
  RAISE EXCEPTION 'duplicate insert unexpectedly succeeded';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 BEGIN
  UPDATE bolt_private.workspace_snapshots SET payload='{}' WHERE owner_id='fake-alice';
  RAISE EXCEPTION 'update unexpectedly permitted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  DELETE FROM bolt_private.workspace_snapshots WHERE owner_id='fake-alice';
  RAISE EXCEPTION 'delete unexpectedly permitted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  CREATE TABLE bolt_private.must_not_create(x int);
  RAISE EXCEPTION 'create table unexpectedly permitted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
DO $$ BEGIN IF (SELECT count(*) FROM bolt_private.workspace_snapshots)<>2 THEN RAISE EXCEPTION 'snapshot count failed'; END IF; END $$;
RESET ROLE;
-- Owner isolation is a trusted service predicate, NOT RLS: runtime can see all owners.
SELECT count(*)=2 AS two_snapshots_preserved FROM bolt_private.workspace_snapshots;
