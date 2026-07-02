-- Deploy 12: Campaign Engine V3 — recipient snapshot columns + indexes.

ALTER TABLE public.campaign_recipients
  ADD COLUMN IF NOT EXISTS enrollment_ref TEXT,
  ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT '{}'::jsonb;

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
