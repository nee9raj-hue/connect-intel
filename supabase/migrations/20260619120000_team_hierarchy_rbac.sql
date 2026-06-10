-- Connect Intel — Team hierarchy + HubSpot-style RBAC at the database layer.
-- Canonical employee row: public.profiles (legacy_user_id = app user id).
-- Fast pipeline scope: denormalized columns on pipeline_leads + COUNT RPCs.

-- ─── 1. Departments ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  legacy_id TEXT,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT departments_org_name_unique UNIQUE (organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_departments_organization_id
  ON public.departments (organization_id);

CREATE INDEX IF NOT EXISTS idx_departments_legacy_id
  ON public.departments (legacy_id)
  WHERE legacy_id IS NOT NULL;

-- ─── 2. Teams ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES public.departments (id) ON DELETE CASCADE,
  manager_profile_id UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  manager_legacy_user_id TEXT,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT teams_dept_name_unique UNIQUE (department_id, name)
);

CREATE INDEX IF NOT EXISTS idx_teams_organization_id ON public.teams (organization_id);
CREATE INDEX IF NOT EXISTS idx_teams_department_id ON public.teams (department_id);
CREATE INDEX IF NOT EXISTS idx_teams_manager_profile_id ON public.teams (manager_profile_id);
CREATE INDEX IF NOT EXISTS idx_teams_manager_legacy_user_id ON public.teams (manager_legacy_user_id)
  WHERE manager_legacy_user_id IS NOT NULL;

-- ─── 3. Profiles (employees / CRM users) ────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_team_id ON public.profiles (team_id);
CREATE INDEX IF NOT EXISTS idx_profiles_department_id ON public.profiles (department_id);
CREATE INDEX IF NOT EXISTS idx_profiles_org_role ON public.profiles (organization_id, role);

-- Readable alias for app/docs (profiles is source of truth).
CREATE OR REPLACE VIEW public.crm_users AS
SELECT
  p.legacy_user_id AS id,
  p.id AS profile_id,
  p.organization_id,
  p.email,
  p.full_name AS name,
  p.role,
  p.team_id,
  p.department_id,
  p.pipeline_role,
  p.can_search,
  p.created_at,
  p.updated_at
FROM public.profiles p
WHERE p.legacy_user_id IS NOT NULL;

COMMENT ON VIEW public.crm_users IS 'Connect Intel — app users mapped from profiles (legacy_user_id = JSON store user id).';

-- ─── 4. pipeline_leads — denormalized scope columns ───────────────────────
ALTER TABLE public.pipeline_leads
  ADD COLUMN IF NOT EXISTS owner_id TEXT,
  ADD COLUMN IF NOT EXISTS team_id TEXT,
  ADD COLUMN IF NOT EXISTS department_id TEXT,
  ADD COLUMN IF NOT EXISTS lead_status TEXT NOT NULL DEFAULT 'new';

CREATE INDEX IF NOT EXISTS idx_pipeline_leads_owner
  ON public.pipeline_leads (shard_name, owner_id)
  WHERE owner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pipeline_leads_team
  ON public.pipeline_leads (organization_id, team_id)
  WHERE team_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pipeline_leads_department
  ON public.pipeline_leads (organization_id, department_id)
  WHERE department_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pipeline_leads_org_status
  ON public.pipeline_leads (organization_id, lead_status);

CREATE INDEX IF NOT EXISTS idx_pipeline_leads_shard_status_owner
  ON public.pipeline_leads (shard_name, lead_status, owner_id);

-- Sync owner + status from JSON entry on write.
CREATE OR REPLACE FUNCTION public.pipeline_leads_sync_scope_cols()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_team_id TEXT;
  v_department_id TEXT;
BEGIN
  NEW.owner_id := COALESCE(
    NULLIF(btrim(NEW.entry->>'assignedToUserId'), ''),
    NULLIF(btrim(NEW.entry->>'savedByUserId'), ''),
    NULLIF(btrim(NEW.user_id), '')
  );
  NEW.lead_status := COALESCE(NULLIF(btrim(NEW.entry->'crm'->>'status'), ''), 'new');

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

DROP TRIGGER IF EXISTS trg_pipeline_leads_sync_scope_cols ON public.pipeline_leads;
CREATE TRIGGER trg_pipeline_leads_sync_scope_cols
  BEFORE INSERT OR UPDATE OF entry, user_id ON public.pipeline_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.pipeline_leads_sync_scope_cols();

-- Backfill existing rows.
UPDATE public.pipeline_leads
SET
  owner_id = COALESCE(
    NULLIF(btrim(entry->>'assignedToUserId'), ''),
    NULLIF(btrim(entry->>'savedByUserId'), ''),
    NULLIF(btrim(user_id), '')
  ),
  lead_status = COALESCE(NULLIF(btrim(entry->'crm'->>'status'), ''), 'new')
WHERE owner_id IS NULL OR lead_status IS NULL OR lead_status = 'new';

-- Backfill team/department from owner profile when available.
UPDATE public.pipeline_leads pl
SET
  team_id = p.team_id::TEXT,
  department_id = p.department_id::TEXT
FROM public.profiles p
WHERE pl.owner_id = p.legacy_user_id
  AND p.team_id IS NOT NULL
  AND (pl.team_id IS NULL OR pl.department_id IS NULL);

-- ─── 5. Scoped COUNT (sidebar + pipeline totals) ──────────────────────────
CREATE OR REPLACE FUNCTION public.ci_count_pipeline_leads_scoped(
  p_shard_name TEXT,
  p_organization_id TEXT DEFAULT NULL,
  p_owner_id TEXT DEFAULT NULL,
  p_team_id TEXT DEFAULT NULL,
  p_department_id TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::BIGINT
  FROM public.pipeline_leads pl
  WHERE pl.shard_name = p_shard_name
    AND (p_organization_id IS NULL OR pl.organization_id = p_organization_id)
    AND (p_owner_id IS NULL OR pl.owner_id = p_owner_id)
    AND (p_team_id IS NULL OR pl.team_id = p_team_id)
    AND (p_department_id IS NULL OR pl.department_id = p_department_id)
    AND (
      p_status IS NULL
      OR p_status = 'all'
      OR pl.lead_status = p_status
    );
$$;

CREATE OR REPLACE FUNCTION public.ci_pipeline_status_counts_scoped(
  p_shard_name TEXT,
  p_organization_id TEXT DEFAULT NULL,
  p_owner_id TEXT DEFAULT NULL,
  p_team_id TEXT DEFAULT NULL,
  p_department_id TEXT DEFAULT NULL
)
RETURNS TABLE (status TEXT, cnt BIGINT)
LANGUAGE sql
STABLE
AS $$
  SELECT pl.lead_status AS status, COUNT(*)::BIGINT AS cnt
  FROM public.pipeline_leads pl
  WHERE pl.shard_name = p_shard_name
    AND (p_organization_id IS NULL OR pl.organization_id = p_organization_id)
    AND (p_owner_id IS NULL OR pl.owner_id = p_owner_id)
    AND (p_team_id IS NULL OR pl.team_id = p_team_id)
    AND (p_department_id IS NULL OR pl.department_id = p_department_id)
  GROUP BY pl.lead_status;
$$;

COMMENT ON FUNCTION public.ci_count_pipeline_leads_scoped IS
  'Indexed COUNT for pipeline_leads with HubSpot-style scope (owner / team / department).';

COMMENT ON FUNCTION public.ci_pipeline_status_counts_scoped IS
  'Per-status counts for sidebar navigation — one grouped query, no shard download.';

GRANT EXECUTE ON FUNCTION public.ci_count_pipeline_leads_scoped TO service_role;
GRANT EXECUTE ON FUNCTION public.ci_pipeline_status_counts_scoped TO service_role;
