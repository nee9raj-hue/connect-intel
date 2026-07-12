-- Bootstrap for docker-compose postgres profile (P2 document store)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS store_collections (
  collection text PRIMARY KEY,
  json jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS store_collections_updated_at_idx ON store_collections (updated_at DESC);

-- Apply full CRM SQL migrations for production parity:
--   psql $DATABASE_URL -f supabase/migrations/20260613120000_enterprise_crm_schema.sql
