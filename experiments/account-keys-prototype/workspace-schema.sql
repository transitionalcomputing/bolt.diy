-- EXPERIMENTAL: dedicated test database only. No production migration or privileges.
-- The Node service is trusted; owner_id comes from verified issuer/subject.
-- Not browser-accessible. No RLS/roles/grants are established by this draft.
CREATE SCHEMA IF NOT EXISTS bolt_private;
CREATE TABLE IF NOT EXISTS bolt_private.workspace_snapshots (
  owner_id text NOT NULL,
  id uuid NOT NULL,
  payload jsonb NOT NULL,
  PRIMARY KEY(owner_id,id),
  CHECK (jsonb_typeof(payload) = 'object'),
  CHECK (payload->>'mode' IS NOT DISTINCT FROM 'inert'),
  CHECK (payload->>'id' IS NOT DISTINCT FROM id::text)
);
