-- P1 constitution: account hierarchy column on pipeline_companies.

ALTER TABLE public.pipeline_companies
  ADD COLUMN IF NOT EXISTS parent_company_id TEXT;

CREATE INDEX IF NOT EXISTS idx_pipeline_companies_org_parent
  ON public.pipeline_companies (organization_id, parent_company_id)
  WHERE parent_company_id IS NOT NULL;

COMMENT ON COLUMN public.pipeline_companies.parent_company_id IS
  'Optional parent account company_id within the same organization.';
