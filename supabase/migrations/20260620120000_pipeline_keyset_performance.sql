-- Pipeline keyset pagination + follow-up indexing (Sprint 1 performance)

ALTER TABLE public.pipeline_leads
  ADD COLUMN IF NOT EXISTS next_followup_date DATE,
  ADD COLUMN IF NOT EXISTS deal_value NUMERIC;

-- Composite index for scoped list + keyset (updated_at DESC, lead_id DESC)
CREATE INDEX IF NOT EXISTS idx_pipeline_leads_scope_keyset
  ON public.pipeline_leads (
    organization_id,
    team_id,
    owner_id,
    lead_status,
    updated_at DESC,
    lead_id DESC
  );

CREATE INDEX IF NOT EXISTS idx_pipeline_leads_followup_due
  ON public.pipeline_leads (organization_id, owner_id, next_followup_date)
  WHERE lead_status = 'follow-up' AND next_followup_date IS NOT NULL;

-- Extend scope sync trigger
CREATE OR REPLACE FUNCTION public.pipeline_leads_sync_scope_cols()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_team_id TEXT;
  v_department_id TEXT;
  v_followup TEXT;
  v_deal_value NUMERIC;
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
  next_followup_date = CASE
    WHEN NULLIF(btrim(pl.entry->'crm'->>'nextFollowUpAt'), '') IS NOT NULL THEN
      (NULLIF(btrim(pl.entry->'crm'->>'nextFollowUpAt'), ''))::timestamptz::date
    ELSE NULL
  END
WHERE pl.next_followup_date IS NULL
  AND NULLIF(btrim(pl.entry->'crm'->>'nextFollowUpAt'), '') IS NOT NULL;

COMMENT ON INDEX public.idx_pipeline_leads_scope_keyset IS
  'Scoped pipeline lists + keyset pagination (organization, team, owner, status, updated_at, lead_id).';
