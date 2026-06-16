-- Denormalized contact + filter columns (safe on any pipeline_leads deployment).

ALTER TABLE public.pipeline_leads
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS lead_score INTEGER,
  ADD COLUMN IF NOT EXISTS deal_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_pipeline_leads_email ON public.pipeline_leads (email);
CREATE INDEX IF NOT EXISTS idx_pipeline_leads_phone ON public.pipeline_leads (phone);
CREATE INDEX IF NOT EXISTS idx_pipeline_leads_city
  ON public.pipeline_leads (organization_id, city)
  WHERE city IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pipeline_leads_state
  ON public.pipeline_leads (organization_id, state)
  WHERE state IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pipeline_leads_lead_score
  ON public.pipeline_leads (organization_id, lead_score)
  WHERE lead_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pipeline_leads_deal_count
  ON public.pipeline_leads (organization_id, deal_count)
  WHERE deal_count > 0;

COMMENT ON COLUMN public.pipeline_leads.email IS 'Denormalized from entry.lead for search and filters.';
COMMENT ON COLUMN public.pipeline_leads.deal_count IS 'Count of deals on entry.crm.deals — speeds deals view scans.';
