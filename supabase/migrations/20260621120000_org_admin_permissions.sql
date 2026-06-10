-- Sprint 2 — Org Admin: role permission matrix + import job tracking

CREATE TABLE IF NOT EXISTS public.role_permissions (
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  action TEXT NOT NULL,
  allowed BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (organization_id, role, action)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_org ON public.role_permissions (organization_id);

CREATE TABLE IF NOT EXISTS public.lead_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  imported_by_profile_id UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  imported_by_legacy_user_id TEXT,
  filename TEXT,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  total_rows INT DEFAULT 0,
  created_count INT DEFAULT 0,
  updated_count INT DEFAULT 0,
  skipped_count INT DEFAULT 0,
  error_count INT DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_lead_imports_org ON public.lead_imports (organization_id, created_at DESC);

COMMENT ON TABLE public.role_permissions IS 'Per-org role × action toggles for Org Admin permissions matrix.';
COMMENT ON TABLE public.lead_imports IS 'Async pipeline CSV import jobs (poll via org/import-status).';

CREATE OR REPLACE FUNCTION public.ci_count_pipeline_leads_by_teams(
  p_organization_id TEXT,
  p_team_ids TEXT[]
)
RETURNS TABLE (team_id TEXT, cnt BIGINT)
LANGUAGE sql
STABLE
AS $$
  SELECT pl.team_id, COUNT(*)::BIGINT AS cnt
  FROM public.pipeline_leads pl
  WHERE pl.organization_id = p_organization_id
    AND pl.team_id IS NOT NULL
    AND pl.team_id = ANY (p_team_ids)
  GROUP BY pl.team_id;
$$;

GRANT EXECUTE ON FUNCTION public.ci_count_pipeline_leads_by_teams TO service_role;
