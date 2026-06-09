-- Deferred CRM email activity: append during send, batch-apply after campaign completes.

CREATE TABLE IF NOT EXISTS public.email_activity_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL,
  lead_id TEXT NOT NULL,
  shard_name TEXT NOT NULL,
  organization_id TEXT,
  user_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed')),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_email_activity_queue_campaign_pending
  ON public.email_activity_queue (campaign_id, status, created_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_email_activity_queue_pending
  ON public.email_activity_queue (status, created_at)
  WHERE status = 'pending';

COMMENT ON TABLE public.email_activity_queue IS 'Connect Intel — CRM email/activity updates deferred from hot send path.';
