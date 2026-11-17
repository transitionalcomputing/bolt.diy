-- EXPERIMENTAL DRAFT ONLY. Not applied to any database.
-- Dedicated Bolt database only, never the LV Computer Help production database.
-- Deployment/roles/grants/RLS/backup/retention policies require separate review.
CREATE SCHEMA IF NOT EXISTS bolt_private;
CREATE TABLE IF NOT EXISTS bolt_private.records (
  namespace text NOT NULL CHECK(namespace IN ('transactions','sessions','credentials')),
  id text NOT NULL,
  payload jsonb NOT NULL,
  PRIMARY KEY(namespace,id)
);
-- Keep this schema outside PostgREST exposed schemas. Do not grant browser roles
-- access. A restricted server role needs only the reviewed table operations.
-- This draft intentionally does not create users, grants, policies or credentials.
