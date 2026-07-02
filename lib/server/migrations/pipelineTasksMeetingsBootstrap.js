/** Bundled for Vercel — mirror of supabase/migrations/20260702130000_pipeline_tasks_meetings_bootstrap.sql */
export const PIPELINE_TASKS_MEETINGS_BOOTSTRAP_SQL = `
CREATE TABLE IF NOT EXISTS public.pipeline_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL,
  lead_id TEXT,
  owner_id TEXT,
  title TEXT,
  due_at TIMESTAMPTZ,
  status TEXT DEFAULT 'open',
  payload JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pipeline_tasks_org_owner ON public.pipeline_tasks (organization_id, owner_id);

CREATE TABLE IF NOT EXISTS public.pipeline_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL,
  lead_id TEXT,
  owner_id TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  payload JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pipeline_meetings_org ON public.pipeline_meetings (organization_id);

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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pipeline_tasks TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pipeline_meetings TO service_role;
`.trim()
