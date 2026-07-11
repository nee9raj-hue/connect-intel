-- Campaigns V3 — columns expected by campaignsV3Table.js (Deploy 12 follow-up).

ALTER TABLE public.campaigns_v3
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS total_recipients INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS correlation_id TEXT;
