-- One-time in Supabase SQL editor (Activity log fast path).
-- Creates pipeline_activities if missing, indexes, and bootstrap RPC.

CREATE TABLE IF NOT EXISTS public.pipeline_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL,
  lead_id TEXT NOT NULL,
  actor_id TEXT,
  type TEXT NOT NULL,
  summary TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_pipeline_activities_lead
  ON public.pipeline_activities (organization_id, lead_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_pipeline_activities_org_occurred
  ON public.pipeline_activities (organization_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_pipeline_activities_org_actor_occurred
  ON public.pipeline_activities (organization_id, actor_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_pipeline_activities_org_type_occurred
  ON public.pipeline_activities (organization_id, type, occurred_at DESC);

CREATE OR REPLACE FUNCTION public.ci_apply_activity_log_indexes()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_pipeline_activities_org_occurred
    ON public.pipeline_activities (organization_id, occurred_at DESC);
  CREATE INDEX IF NOT EXISTS idx_pipeline_activities_org_actor_occurred
    ON public.pipeline_activities (organization_id, actor_id, occurred_at DESC);
  CREATE INDEX IF NOT EXISTS idx_pipeline_activities_org_type_occurred
    ON public.pipeline_activities (organization_id, type, occurred_at DESC);
  RETURN jsonb_build_object('ok', true);
END;
$$;

COMMENT ON TABLE public.pipeline_activities IS 'Connect Intel — denormalized CRM activity feed for indexed activity log reads.';
