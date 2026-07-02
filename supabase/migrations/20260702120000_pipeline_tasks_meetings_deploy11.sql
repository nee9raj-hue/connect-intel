-- Deploy 11: natural keys for pipeline_tasks / pipeline_meetings upsert (mirror pipeline_deals).

ALTER TABLE public.pipeline_tasks
  ADD COLUMN IF NOT EXISTS task_id TEXT;

ALTER TABLE public.pipeline_meetings
  ADD COLUMN IF NOT EXISTS meeting_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS pipeline_tasks_org_task_unique
  ON public.pipeline_tasks (organization_id, task_id)
  WHERE task_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS pipeline_meetings_org_meeting_unique
  ON public.pipeline_meetings (organization_id, meeting_id)
  WHERE meeting_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pipeline_tasks_org_due
  ON public.pipeline_tasks (organization_id, owner_id, due_at)
  WHERE status IS DISTINCT FROM 'done';

CREATE INDEX IF NOT EXISTS idx_pipeline_meetings_org_starts
  ON public.pipeline_meetings (organization_id, owner_id, starts_at);
