-- Deploy 5 — pipeline_deals query indexes (table from crm_relational_v3).
CREATE INDEX IF NOT EXISTS idx_pipeline_deals_org_stage_updated
  ON public.pipeline_deals (organization_id, stage, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_pipeline_deals_org_updated
  ON public.pipeline_deals (organization_id, updated_at DESC);

COMMENT ON TABLE public.pipeline_deals IS 'Normalized CRM deals — one row per deal; synced from pipeline entry JSON.';
