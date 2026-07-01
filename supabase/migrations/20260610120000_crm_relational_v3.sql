-- Connect Intel CRM V3 — relational tables (zero-downtime migration phase 1)
-- Run in Supabase SQL editor. Enable reads/writes with USE_PIPELINE_LEADS_TABLE=true after backfill.

-- ─── Core pipeline row (one lead per row) ───────────────────────────────────
-- Table may already exist from 20260609120000 — add missing columns before indexes.
CREATE TABLE IF NOT EXISTS public.pipeline_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id TEXT NOT NULL,
  shard_name TEXT NOT NULL,
  organization_id TEXT,
  user_id TEXT,
  entry JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pipeline_leads_shard_lead_unique UNIQUE (shard_name, lead_id)
);

ALTER TABLE public.pipeline_leads
  ADD COLUMN IF NOT EXISTS owner_id TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT;

CREATE INDEX IF NOT EXISTS idx_pipeline_leads_org ON public.pipeline_leads (organization_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_leads_owner ON public.pipeline_leads (owner_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_leads_email ON public.pipeline_leads (email);
CREATE INDEX IF NOT EXISTS idx_pipeline_leads_phone ON public.pipeline_leads (phone);
CREATE INDEX IF NOT EXISTS idx_pipeline_leads_updated ON public.pipeline_leads (updated_at DESC);

-- ─── Normalized CRM entities (extracted from entry.crm over time) ───────────
CREATE TABLE IF NOT EXISTS public.pipeline_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL,
  company_id TEXT,
  name TEXT,
  domain TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pipeline_companies_org ON public.pipeline_companies (organization_id);

CREATE TABLE IF NOT EXISTS public.pipeline_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL,
  lead_id TEXT NOT NULL,
  deal_id TEXT NOT NULL,
  stage TEXT,
  amount NUMERIC,
  owner_id TEXT,
  payload JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pipeline_deals_org_deal_unique UNIQUE (organization_id, deal_id)
);
CREATE INDEX IF NOT EXISTS idx_pipeline_deals_org ON public.pipeline_deals (organization_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_deals_lead ON public.pipeline_deals (lead_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_deals_owner ON public.pipeline_deals (owner_id);

CREATE TABLE IF NOT EXISTS public.pipeline_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL,
  lead_id TEXT NOT NULL,
  author_id TEXT,
  body TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pipeline_notes_lead ON public.pipeline_notes (organization_id, lead_id);

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
CREATE INDEX IF NOT EXISTS idx_pipeline_activities_lead ON public.pipeline_activities (organization_id, lead_id, occurred_at DESC);

-- ─── Campaign Engine V3 (Mailchimp-style) ───────────────────────────────────
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

COMMENT ON TABLE public.pipeline_leads IS 'V3: one row per pipeline lead — replaces full-shard reads at scale.';
