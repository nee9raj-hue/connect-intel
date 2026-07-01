-- Deploy 6 — pipeline_companies indexes + unique company key per org.

CREATE TABLE IF NOT EXISTS public.pipeline_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  name TEXT,
  domain TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pipeline_companies_org_company_id
  ON public.pipeline_companies (organization_id, company_id);

CREATE INDEX IF NOT EXISTS idx_pipeline_companies_org_name
  ON public.pipeline_companies (organization_id, name);

CREATE INDEX IF NOT EXISTS idx_pipeline_companies_org_updated
  ON public.pipeline_companies (organization_id, updated_at DESC);

COMMENT ON TABLE public.pipeline_companies IS 'Aggregated CRM accounts — one row per company name per org; synced from pipeline leads.';
