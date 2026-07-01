-- Workflow versioning + run log (Deploy 4).
-- Apply in Supabase SQL editor if not using automated migrations.

CREATE TABLE IF NOT EXISTS public.workflow_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations (id) ON DELETE CASCADE,
  legacy_org_id TEXT,
  workflow_key TEXT NOT NULL,
  workflow_type TEXT NOT NULL CHECK (
    workflow_type IN ('marketing_automation', 'crm_rule', 'crm_visual')
  ),
  version INT NOT NULL DEFAULT 1,
  definition JSONB NOT NULL DEFAULT '{}'::jsonb,
  definition_hash TEXT,
  engine_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_workflow_versions_org_key_ver
  ON public.workflow_versions (legacy_org_id, workflow_key, version)
  WHERE legacy_org_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workflow_versions_org
  ON public.workflow_versions (legacy_org_id, workflow_key, created_at DESC);

CREATE TABLE IF NOT EXISTS public.workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations (id) ON DELETE CASCADE,
  legacy_org_id TEXT,
  workflow_version_id UUID REFERENCES public.workflow_versions (id) ON DELETE SET NULL,
  workflow_key TEXT,
  workflow_type TEXT,
  trigger_type TEXT NOT NULL,
  lead_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (
    status IN ('queued', 'running', 'completed', 'failed', 'skipped')
  ),
  idempotency_key TEXT,
  actor_legacy_user_id TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_workflow_runs_idempotency
  ON public.workflow_runs (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workflow_runs_org_created
  ON public.workflow_runs (legacy_org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_lead
  ON public.workflow_runs (lead_id, created_at DESC);

COMMENT ON TABLE public.workflow_versions IS 'Immutable workflow definition snapshots for CRM rules and marketing automations.';
COMMENT ON TABLE public.workflow_runs IS 'Append-only workflow execution log with idempotent dispatch.';
