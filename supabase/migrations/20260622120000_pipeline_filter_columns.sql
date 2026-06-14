-- Denormalized pipeline list filters (city, state, lead score, deal count)

ALTER TABLE public.pipeline_leads
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS lead_score INTEGER,
  ADD COLUMN IF NOT EXISTS deal_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_pipeline_leads_city
  ON public.pipeline_leads (organization_id, city)
  WHERE city IS NOT NULL AND btrim(city) <> '';

CREATE INDEX IF NOT EXISTS idx_pipeline_leads_state
  ON public.pipeline_leads (organization_id, state)
  WHERE state IS NOT NULL AND btrim(state) <> '';

CREATE INDEX IF NOT EXISTS idx_pipeline_leads_lead_score
  ON public.pipeline_leads (organization_id, lead_score)
  WHERE lead_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pipeline_leads_deal_count
  ON public.pipeline_leads (organization_id, deal_count)
  WHERE deal_count > 0;

CREATE OR REPLACE FUNCTION public.pipeline_leads_sync_scope_cols()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_team_id TEXT;
  v_department_id TEXT;
  v_followup TEXT;
  v_deal_value NUMERIC;
  v_lead JSONB;
  v_location TEXT;
  v_city TEXT;
  v_state TEXT;
  v_score TEXT;
  v_deals JSONB;
BEGIN
  NEW.owner_id := COALESCE(
    NULLIF(btrim(NEW.entry->>'assignedToUserId'), ''),
    NULLIF(btrim(NEW.entry->>'savedByUserId'), ''),
    NULLIF(btrim(NEW.user_id), '')
  );
  NEW.lead_status := COALESCE(NULLIF(btrim(NEW.entry->'crm'->>'status'), ''), 'new');

  v_followup := NULLIF(btrim(NEW.entry->'crm'->>'nextFollowUpAt'), '');
  IF v_followup IS NOT NULL THEN
    BEGIN
      NEW.next_followup_date := v_followup::timestamptz::date;
    EXCEPTION WHEN OTHERS THEN
      BEGIN
        NEW.next_followup_date := v_followup::date;
      EXCEPTION WHEN OTHERS THEN
        NEW.next_followup_date := NULL;
      END;
    END;
  ELSE
    NEW.next_followup_date := NULL;
  END IF;

  BEGIN
    v_deal_value := NULLIF(btrim(NEW.entry->'crm'->>'dealValue'), '')::numeric;
  EXCEPTION WHEN OTHERS THEN
    v_deal_value := NULL;
  END;
  IF v_deal_value IS NOT NULL THEN
    NEW.deal_value := v_deal_value;
  END IF;

  v_lead := COALESCE(NEW.entry->'lead', '{}'::jsonb);
  v_city := NULLIF(btrim(v_lead->>'city'), '');
  v_state := NULLIF(btrim(v_lead->>'state'), '');
  IF v_city IS NULL OR v_state IS NULL THEN
    v_location := NULLIF(btrim(v_lead->>'location'), '');
    IF v_location IS NOT NULL AND position(',' IN v_location) > 0 THEN
      IF v_city IS NULL THEN
        v_city := NULLIF(btrim(split_part(v_location, ',', 1)), '');
      END IF;
      IF v_state IS NULL THEN
        v_state := NULLIF(btrim(split_part(v_location, ',', 2)), '');
      END IF;
    ELSIF v_city IS NULL AND v_location IS NOT NULL THEN
      v_city := v_location;
    END IF;
  END IF;
  NEW.city := v_city;
  NEW.state := v_state;

  v_score := NULLIF(btrim(NEW.entry->'crm'->>'leadScore'), '');
  IF v_score IS NOT NULL THEN
    BEGIN
      NEW.lead_score := v_score::integer;
    EXCEPTION WHEN OTHERS THEN
      NEW.lead_score := NULL;
    END;
  ELSE
    NEW.lead_score := NULL;
  END IF;

  v_deals := COALESCE(NEW.entry->'crm'->'deals', '[]'::jsonb);
  IF jsonb_typeof(v_deals) = 'array' THEN
    NEW.deal_count := jsonb_array_length(v_deals);
  ELSE
    NEW.deal_count := 0;
  END IF;

  IF NEW.owner_id IS NOT NULL THEN
    SELECT p.team_id::TEXT, p.department_id::TEXT
    INTO v_team_id, v_department_id
    FROM public.profiles p
    WHERE p.legacy_user_id = NEW.owner_id
    LIMIT 1;
    IF v_team_id IS NOT NULL THEN
      NEW.team_id := v_team_id;
    END IF;
    IF v_department_id IS NOT NULL THEN
      NEW.department_id := v_department_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

UPDATE public.pipeline_leads pl
SET
  city = sub.city,
  state = sub.state,
  lead_score = sub.lead_score,
  deal_count = sub.deal_count
FROM (
  SELECT
    pl2.id,
    NULLIF(
      btrim(COALESCE(pl2.entry->'lead'->>'city', split_part(COALESCE(pl2.entry->'lead'->>'location', ''), ',', 1))),
      ''
    ) AS city,
    NULLIF(
      btrim(COALESCE(pl2.entry->'lead'->>'state', NULLIF(split_part(COALESCE(pl2.entry->'lead'->>'location', ''), ',', 2), ''))),
      ''
    ) AS state,
    CASE
      WHEN NULLIF(btrim(pl2.entry->'crm'->>'leadScore'), '') ~ '^-?[0-9]+$' THEN
        (NULLIF(btrim(pl2.entry->'crm'->>'leadScore'), ''))::integer
      ELSE NULL
    END AS lead_score,
    CASE
      WHEN jsonb_typeof(COALESCE(pl2.entry->'crm'->'deals', '[]'::jsonb)) = 'array' THEN
        jsonb_array_length(COALESCE(pl2.entry->'crm'->'deals', '[]'::jsonb))
      ELSE 0
    END AS deal_count
  FROM public.pipeline_leads pl2
) sub
WHERE pl.id = sub.id
  AND (
    pl.city IS DISTINCT FROM sub.city
    OR pl.state IS DISTINCT FROM sub.state
    OR pl.lead_score IS DISTINCT FROM sub.lead_score
    OR pl.deal_count IS DISTINCT FROM sub.deal_count
  );

COMMENT ON COLUMN public.pipeline_leads.city IS 'Denormalized from entry.lead for scoped list filters.';
COMMENT ON COLUMN public.pipeline_leads.state IS 'Denormalized from entry.lead for scoped list filters.';
COMMENT ON COLUMN public.pipeline_leads.lead_score IS 'Denormalized from entry.crm.leadScore for scoped list filters.';
COMMENT ON COLUMN public.pipeline_leads.deal_count IS 'Count of deals on entry.crm.deals — speeds deals view lead scans.';
