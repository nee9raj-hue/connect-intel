-- Per-lead pipeline rows: patch N leads without reading/writing the full org shard JSON blob.
-- Enable with USE_PIPELINE_LEADS_TABLE=true after running this migration.

CREATE TABLE IF NOT EXISTS public.pipeline_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id TEXT NOT NULL,
  shard_name TEXT NOT NULL,
  organization_id TEXT,
  user_id TEXT,
  entry JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pipeline_leads_shard_lead_unique UNIQUE (shard_name, lead_id)
);

CREATE INDEX IF NOT EXISTS idx_pipeline_leads_org ON public.pipeline_leads (organization_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_leads_shard ON public.pipeline_leads (shard_name);
CREATE INDEX IF NOT EXISTS idx_pipeline_leads_updated ON public.pipeline_leads (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_leads_entry_gin ON public.pipeline_leads USING gin (entry jsonb_path_ops);

COMMENT ON TABLE public.pipeline_leads IS 'Connect Intel pipeline entries — one row per lead; replaces full-shard rewrites at scale.';
