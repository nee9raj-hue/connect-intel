-- Personal lead tags: same name allowed for different reps; shared tags stay unique per org.

DROP INDEX IF EXISTS public.idx_lead_tag_master_org_slug_live;

CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_tag_master_org_slug_shared
  ON public.lead_tag_master (organization_id, name_slug)
  WHERE archived_at IS NULL AND coalesce(source, '') <> 'personal';

CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_tag_master_org_slug_personal
  ON public.lead_tag_master (organization_id, name_slug, created_by_user_id)
  WHERE archived_at IS NULL AND source = 'personal';
