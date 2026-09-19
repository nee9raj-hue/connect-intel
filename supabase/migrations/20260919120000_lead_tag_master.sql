-- Canonical lead tag master (pipeline Tags). App org id is organizations.legacy_id.
-- Existing crm.tagIds keep working: id is the same tag_* value from the org JSON store.

CREATE TABLE IF NOT EXISTS public.lead_tag_master (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  organization_uuid UUID REFERENCES public.organizations (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_slug TEXT NOT NULL,
  color TEXT,
  team_id TEXT,
  source TEXT,
  engagement_slug TEXT,
  created_by_user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  archived_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_lead_tag_master_org
  ON public.lead_tag_master (organization_id)
  WHERE archived_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_tag_master_org_slug_live
  ON public.lead_tag_master (organization_id, name_slug)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_lead_tag_master_org_uuid
  ON public.lead_tag_master (organization_uuid)
  WHERE organization_uuid IS NOT NULL;

COMMENT ON TABLE public.lead_tag_master IS
  'Connect Intel tag master — org-scoped lead tag definitions for pipeline filters.';

CREATE OR REPLACE FUNCTION public.lead_tag_master_normalize()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.name := btrim(NEW.name);
  NEW.name_slug := lower(regexp_replace(NEW.name, '\s+', ' ', 'g'));
  IF NEW.organization_uuid IS NULL AND NEW.organization_id IS NOT NULL THEN
    SELECT o.id
      INTO NEW.organization_uuid
      FROM public.organizations o
     WHERE o.legacy_id = NEW.organization_id
     LIMIT 1;
  END IF;
  NEW.updated_at := timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lead_tag_master_normalize ON public.lead_tag_master;
CREATE TRIGGER trg_lead_tag_master_normalize
  BEFORE INSERT OR UPDATE ON public.lead_tag_master
  FOR EACH ROW
  EXECUTE FUNCTION public.lead_tag_master_normalize();

ALTER TABLE public.lead_tag_master ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lead_tag_master_service ON public.lead_tag_master;
CREATE POLICY lead_tag_master_service
  ON public.lead_tag_master
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_tag_master TO service_role;

NOTIFY pgrst, 'reload schema';
