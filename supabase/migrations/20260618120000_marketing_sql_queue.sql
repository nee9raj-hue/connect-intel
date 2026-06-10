-- Marketing Hub: SQL-backed email queue + analytics snapshots (no Redis).
-- Runtime campaign metadata remains in store_collections; queue is the hot send path.

CREATE TABLE IF NOT EXISTS public.marketing_campaign_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL,
  organization_id TEXT,
  user_id TEXT NOT NULL,
  shard_name TEXT NOT NULL,
  total_jobs INT NOT NULL DEFAULT 0,
  completed_jobs INT NOT NULL DEFAULT 0,
  failed_jobs INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_marketing_campaign_batches_campaign
  ON public.marketing_campaign_batches (campaign_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_marketing_campaign_batches_org
  ON public.marketing_campaign_batches (organization_id, created_at DESC)
  WHERE organization_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.marketing_email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.marketing_campaign_batches(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL,
  lead_id TEXT NOT NULL,
  enrollment_id TEXT,
  organization_id TEXT,
  user_id TEXT NOT NULL,
  shard_name TEXT NOT NULL,
  to_email TEXT NOT NULL,
  first_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'skipped', 'cancelled')),
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  provider_message_id TEXT,
  locked_at TIMESTAMPTZ,
  worker_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  UNIQUE (campaign_id, lead_id)
);

CREATE INDEX IF NOT EXISTS idx_marketing_email_queue_pending
  ON public.marketing_email_queue (status, created_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_marketing_email_queue_campaign_status
  ON public.marketing_email_queue (campaign_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_marketing_email_queue_lead
  ON public.marketing_email_queue (lead_id, campaign_id);

CREATE TABLE IF NOT EXISTS public.marketing_analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL DEFAULT '',
  period TEXT NOT NULL DEFAULT 'rolling',
  emails_sent INT NOT NULL DEFAULT 0,
  emails_delivered INT NOT NULL DEFAULT 0,
  opens INT NOT NULL DEFAULT 0,
  clicks INT NOT NULL DEFAULT 0,
  bounces INT NOT NULL DEFAULT 0,
  unsubscribes INT NOT NULL DEFAULT 0,
  open_rate NUMERIC(8, 4) NOT NULL DEFAULT 0,
  click_rate NUMERIC(8, 4) NOT NULL DEFAULT 0,
  bounce_rate NUMERIC(8, 4) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_analytics_snapshots_scope
  ON public.marketing_analytics_snapshots (organization_id, campaign_id, period);

CREATE INDEX IF NOT EXISTS idx_marketing_analytics_snapshots_org
  ON public.marketing_analytics_snapshots (organization_id, period);

COMMENT ON TABLE public.marketing_campaign_batches IS 'Connect Intel — marketing send batches (one per campaign start).';
COMMENT ON TABLE public.marketing_email_queue IS 'Connect Intel — per-recipient marketing email jobs (SQL queue, no Redis).';
COMMENT ON TABLE public.marketing_analytics_snapshots IS 'Connect Intel — pre-aggregated marketing KPI cache for fast dashboards.';

-- Claim pending jobs safely (SKIP LOCKED) for cron / worker loops.
CREATE OR REPLACE FUNCTION public.ci_claim_marketing_email_queue(
  p_limit INT,
  p_worker TEXT DEFAULT 'worker'
)
RETURNS SETOF public.marketing_email_queue
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.marketing_email_queue q
  SET
    status = 'processing',
    locked_at = now(),
    worker_id = p_worker,
    attempts = q.attempts + 1
  WHERE q.id IN (
    SELECT id
    FROM public.marketing_email_queue
    WHERE status = 'pending'
    ORDER BY created_at
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 500))
    FOR UPDATE SKIP LOCKED
  )
  RETURNING q.*;
END;
$$;

-- Increment analytics snapshot counters (org + optional campaign scope).
CREATE OR REPLACE FUNCTION public.ci_increment_marketing_analytics_snapshot(
  p_organization_id TEXT,
  p_campaign_id TEXT DEFAULT '',
  p_period TEXT DEFAULT 'rolling',
  p_sent INT DEFAULT 0,
  p_delivered INT DEFAULT 0,
  p_opens INT DEFAULT 0,
  p_clicks INT DEFAULT 0,
  p_bounces INT DEFAULT 0,
  p_unsubscribes INT DEFAULT 0
)
RETURNS public.marketing_analytics_snapshots
LANGUAGE plpgsql
AS $$
DECLARE
  row public.marketing_analytics_snapshots;
  v_sent INT;
  v_delivered INT;
  v_opens INT;
  v_clicks INT;
  v_bounces INT;
BEGIN
  INSERT INTO public.marketing_analytics_snapshots (
    organization_id,
    campaign_id,
    period,
    emails_sent,
    emails_delivered,
    opens,
    clicks,
    bounces,
    unsubscribes,
    updated_at
  )
  VALUES (
    p_organization_id,
    COALESCE(NULLIF(p_campaign_id, ''), ''),
    COALESCE(p_period, 'rolling'),
    GREATEST(0, COALESCE(p_sent, 0)),
    GREATEST(0, COALESCE(p_delivered, 0)),
    GREATEST(0, COALESCE(p_opens, 0)),
    GREATEST(0, COALESCE(p_clicks, 0)),
    GREATEST(0, COALESCE(p_bounces, 0)),
    GREATEST(0, COALESCE(p_unsubscribes, 0)),
    now()
  )
  ON CONFLICT (organization_id, campaign_id, period)
  DO UPDATE SET
    emails_sent = marketing_analytics_snapshots.emails_sent + GREATEST(0, COALESCE(p_sent, 0)),
    emails_delivered = marketing_analytics_snapshots.emails_delivered + GREATEST(0, COALESCE(p_delivered, 0)),
    opens = marketing_analytics_snapshots.opens + GREATEST(0, COALESCE(p_opens, 0)),
    clicks = marketing_analytics_snapshots.clicks + GREATEST(0, COALESCE(p_clicks, 0)),
    bounces = marketing_analytics_snapshots.bounces + GREATEST(0, COALESCE(p_bounces, 0)),
    unsubscribes = marketing_analytics_snapshots.unsubscribes + GREATEST(0, COALESCE(p_unsubscribes, 0)),
    updated_at = now()
  RETURNING * INTO row;

  v_sent := GREATEST(row.emails_sent, 1);
  v_delivered := GREATEST(row.emails_delivered, 0);
  v_opens := row.opens;
  v_clicks := row.clicks;
  v_bounces := row.bounces;

  UPDATE public.marketing_analytics_snapshots
  SET
    open_rate = ROUND((v_opens::NUMERIC / v_sent) * 100, 2),
    click_rate = ROUND((v_clicks::NUMERIC / v_sent) * 100, 2),
    bounce_rate = ROUND((v_bounces::NUMERIC / v_sent) * 100, 2),
    updated_at = now()
  WHERE id = row.id
  RETURNING * INTO row;

  RETURN row;
END;
$$;
