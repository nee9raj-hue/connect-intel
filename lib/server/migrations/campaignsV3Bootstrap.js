/** Bundled for Vercel — mirror of supabase/migrations/20260703120000_campaigns_v3_deploy12.sql + base tables */
export const CAMPAIGNS_V3_BOOTSTRAP_SQL = `
CREATE TABLE IF NOT EXISTS public.campaigns_v3 (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  name TEXT,
  channel TEXT DEFAULT 'email',
  status TEXT DEFAULT 'draft',
  send_status TEXT DEFAULT 'draft',
  provider TEXT,
  created_by TEXT,
  stats JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_campaigns_v3_org ON public.campaigns_v3 (organization_id);

CREATE TABLE IF NOT EXISTS public.campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL REFERENCES public.campaigns_v3(id) ON DELETE CASCADE,
  lead_id TEXT,
  email TEXT NOT NULL,
  status TEXT DEFAULT 'queued',
  next_send_at TIMESTAMPTZ,
  enrollment_ref TEXT,
  payload JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign ON public.campaign_recipients (campaign_id, status);

CREATE TABLE IF NOT EXISTS public.campaign_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL,
  recipient_id UUID,
  event_type TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_campaign_events_campaign ON public.campaign_events (campaign_id, event_type);

CREATE TABLE IF NOT EXISTS public.campaign_stats (
  campaign_id TEXT PRIMARY KEY REFERENCES public.campaigns_v3(id) ON DELETE CASCADE,
  queued INT DEFAULT 0,
  sending INT DEFAULT 0,
  sent INT DEFAULT 0,
  delivered INT DEFAULT 0,
  opened INT DEFAULT 0,
  clicked INT DEFAULT 0,
  bounced INT DEFAULT 0,
  failed INT DEFAULT 0,
  unsubscribed INT DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.campaigns_v3
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS total_recipients INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS correlation_id TEXT;

ALTER TABLE public.campaign_recipients
  ADD COLUMN IF NOT EXISTS enrollment_ref TEXT,
  ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.campaign_recipients
  DROP CONSTRAINT IF EXISTS campaign_recipients_campaign_enrollment_key;

ALTER TABLE public.campaign_recipients
  ADD CONSTRAINT campaign_recipients_campaign_enrollment_key
  UNIQUE (campaign_id, enrollment_ref);

CREATE UNIQUE INDEX IF NOT EXISTS campaign_recipients_campaign_enrollment_unique
  ON public.campaign_recipients (campaign_id, enrollment_ref)
  WHERE enrollment_ref IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_campaign_recipients_due
  ON public.campaign_recipients (campaign_id, status, next_send_at);

CREATE INDEX IF NOT EXISTS idx_campaigns_v3_org_status
  ON public.campaigns_v3 (organization_id, send_status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns_v3 TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_recipients TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_stats TO service_role;
`.trim()
