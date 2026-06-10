-- Activity log hot path: indexed org + time range counts and feed pagination.

CREATE INDEX IF NOT EXISTS idx_pipeline_activities_org_occurred
  ON public.pipeline_activities (organization_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_pipeline_activities_org_actor_occurred
  ON public.pipeline_activities (organization_id, actor_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_pipeline_activities_org_type_occurred
  ON public.pipeline_activities (organization_id, type, occurred_at DESC);

COMMENT ON INDEX idx_pipeline_activities_org_occurred IS 'Activity log feed + total counts by period';
