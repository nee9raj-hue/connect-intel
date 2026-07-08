-- Enterprise Messaging Platform: job-level fields on campaigns_v3
ALTER TABLE campaigns_v3 ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE campaigns_v3 ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
ALTER TABLE campaigns_v3 ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE campaigns_v3 ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE campaigns_v3 ADD COLUMN IF NOT EXISTS total_recipients INT NOT NULL DEFAULT 0;
ALTER TABLE campaigns_v3 ADD COLUMN IF NOT EXISTS correlation_id TEXT;

ALTER TABLE campaign_recipients ADD COLUMN IF NOT EXISTS attempts INT NOT NULL DEFAULT 0;
ALTER TABLE campaign_recipients ADD COLUMN IF NOT EXISTS last_error TEXT;

CREATE INDEX IF NOT EXISTS idx_campaigns_v3_source ON campaigns_v3 (source);
CREATE INDEX IF NOT EXISTS idx_campaign_events_type ON campaign_events (event_type, occurred_at DESC);
