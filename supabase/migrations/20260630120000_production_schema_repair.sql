-- Connect Intel — production schema repair (safe to re-run).
--
-- Use when:
--   • crm_relational_v3 failed with: column "email" does not exist
--   • deploy5 failed with: relation "pipeline_deals" does not exist
--
-- pipeline_activities / activity_log migration can succeed independently — no need to re-run.

-- ─── 1. pipeline_leads — add columns missing from early 20260609120000 migration ───
ALTER TABLE public.pipeline_leads
  ADD COLUMN IF NOT EXISTS owner_id TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS team_id TEXT,
  ADD COLUMN IF NOT EXISTS department_id TEXT,
  ADD COLUMN IF NOT EXISTS lead_status TEXT DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS lead_score INTEGER,
  ADD COLUMN IF NOT EXISTS deal_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_followup_date DATE,
  ADD COLUMN IF NOT EXISTS deal_value NUMERIC;

UPDATE public.pipeline_leads SET lead_status = 'new' WHERE lead_status IS NULL;

CREATE INDEX IF NOT EXISTS idx_pipeline_leads_owner ON public.pipeline_leads (owner_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_leads_email ON public.pipeline_leads (email);
CREATE INDEX IF NOT EXISTS idx_pipeline_leads_phone ON public.pipeline_leads (phone);
CREATE INDEX IF NOT EXISTS idx_pipeline_leads_org_status
  ON public.pipeline_leads (organization_id, lead_status);

-- ─── 2. pipeline_deals (v3 — skipped when v3 failed on email index) ─────────────
CREATE TABLE IF NOT EXISTS public.pipeline_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL,
  lead_id TEXT NOT NULL,
  deal_id TEXT NOT NULL,
  stage TEXT,
  amount NUMERIC,
  owner_id TEXT,
  payload JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pipeline_deals_org_deal_unique UNIQUE (organization_id, deal_id)
);

CREATE INDEX IF NOT EXISTS idx_pipeline_deals_org ON public.pipeline_deals (organization_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_deals_lead ON public.pipeline_deals (lead_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_deals_owner ON public.pipeline_deals (owner_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_deals_org_stage_updated
  ON public.pipeline_deals (organization_id, stage, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_deals_org_updated
  ON public.pipeline_deals (organization_id, updated_at DESC);

COMMENT ON TABLE public.pipeline_deals IS 'Normalized CRM deals — one row per deal; synced from pipeline entry JSON.';

-- ─── 2b. pipeline_companies (Deploy 6) ────────────────────────────────────────
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

-- ─── 3. Deploy 3–4 tables (if not applied yet) ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations (id) ON DELETE CASCADE,
  legacy_org_id TEXT,
  actor_legacy_user_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  outcome TEXT NOT NULL DEFAULT 'success' CHECK (outcome IN ('success', 'denied', 'failure')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_audit_events_legacy_org_created
  ON public.audit_events (legacy_org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_events_org_created
  ON public.audit_events (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_events_action
  ON public.audit_events (action, created_at DESC);

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

-- ─── 4. Verify (optional — shows row counts) ──────────────────────────────────
SELECT 'pipeline_leads' AS tbl, count(*)::bigint AS rows FROM public.pipeline_leads
UNION ALL
SELECT 'pipeline_deals', count(*)::bigint FROM public.pipeline_deals
UNION ALL
SELECT 'pipeline_companies', count(*)::bigint FROM public.pipeline_companies
UNION ALL
SELECT 'pipeline_activities', count(*)::bigint FROM public.pipeline_activities
UNION ALL
SELECT 'audit_events', count(*)::bigint FROM public.audit_events;
