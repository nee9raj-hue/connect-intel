-- Callable from production bootstrap (PostgREST rpc/ci_apply_activity_log_indexes).

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

COMMENT ON FUNCTION public.ci_apply_activity_log_indexes IS 'Connect Intel — apply activity log indexes (idempotent).';
