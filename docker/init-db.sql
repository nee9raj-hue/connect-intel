-- Minimal bootstrap for docker-compose postgres (SQL tables evolve via supabase/migrations/)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Placeholder — apply full migrations for production parity:
--   psql $DATABASE_URL -f supabase/migrations/20260609120000_pipeline_leads.sql
-- Document store JSON path may still use sqlite file volume until full PG migration.
