-- P1: Immutable per-message email send audit (constitution / EMAIL_ENGINE.md).

CREATE TABLE IF NOT EXISTS public.email_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations (id) ON DELETE CASCADE,
  legacy_org_id TEXT,
  actor_legacy_user_id TEXT,
  channel TEXT NOT NULL DEFAULT 'email',
  source TEXT NOT NULL,
  provider TEXT,
  provider_message_id TEXT,
  to_email TEXT,
  lead_id TEXT,
  campaign_id TEXT,
  enrollment_id TEXT,
  deal_id TEXT,
  subject TEXT,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'suppressed')),
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_email_sends_legacy_org_sent
  ON public.email_sends (legacy_org_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_sends_org_sent
  ON public.email_sends (organization_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_sends_campaign
  ON public.email_sends (campaign_id, sent_at DESC)
  WHERE campaign_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_sends_lead
  ON public.email_sends (lead_id, sent_at DESC)
  WHERE lead_id IS NOT NULL;

COMMENT ON TABLE public.email_sends IS 'Append-only audit row per outbound email (CRM 1:1 + marketing campaigns).';
