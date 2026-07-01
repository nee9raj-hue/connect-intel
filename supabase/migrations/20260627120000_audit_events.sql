-- Immutable org-scoped audit stream (Deploy 3).
-- Apply in Supabase SQL editor if not using automated migrations.

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

COMMENT ON TABLE public.audit_events IS 'Append-only audit trail for permissions, workflows, and admin mutations.';
