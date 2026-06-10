-- Connect Intel — leads RLS (tenant isolation + role-based assignee scoping)
--
-- Rules:
--   • Caller must belong to the same organization_id as the lead row.
--   • admin/manager: full CRUD on all leads in their organization.
--   • rep: SELECT/INSERT/UPDATE/DELETE only on rows where assigned_to = caller's profile id.
--
-- Performance: SECURITY DEFINER helpers read profiles once (bypasses profiles RLS, no recursion).
-- service_role (Vercel) bypasses RLS; policies apply to authenticated JWT users only.

-- ─── Drop legacy leads policies (idempotent re-apply) ───────────────────────
DROP POLICY IF EXISTS leads_select_tenant ON public.leads;
DROP POLICY IF EXISTS leads_insert_admin ON public.leads;
DROP POLICY IF EXISTS leads_update_tenant ON public.leads;
DROP POLICY IF EXISTS leads_delete_tenant ON public.leads;

-- ─── Caller context (one indexed lookup per policy evaluation) ──────────────
CREATE OR REPLACE FUNCTION public._caller_profile_for_leads()
RETURNS TABLE (
  profile_id UUID,
  organization_id UUID,
  role TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.organization_id, p.role
  FROM public.profiles p
  WHERE p.auth_user_id = auth.uid()
  LIMIT 1;
$$;

COMMENT ON FUNCTION public._caller_profile_for_leads() IS
  'RLS helper: current auth user profile row (SECURITY DEFINER, no profiles RLS recursion).';

-- ─── Row access: existing lead (USING / DELETE) ───────────────────────────
CREATE OR REPLACE FUNCTION public.leads_row_accessible(
  p_organization_id UUID,
  p_assigned_to UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public._caller_profile_for_leads() c
    WHERE c.organization_id = p_organization_id
      AND (
        c.role IN ('admin', 'manager')
        OR (c.role = 'rep' AND p_assigned_to IS NOT NULL AND p_assigned_to = c.profile_id)
      )
  );
$$;

COMMENT ON FUNCTION public.leads_row_accessible(UUID, UUID) IS
  'True when authenticated user may read/update/delete this lead row.';

-- ─── Insert / update target row (WITH CHECK) ────────────────────────────────
CREATE OR REPLACE FUNCTION public.leads_row_writable(
  p_organization_id UUID,
  p_assigned_to UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public._caller_profile_for_leads() c
    WHERE c.organization_id = p_organization_id
      AND (
        c.role IN ('admin', 'manager')
        OR (c.role = 'rep' AND p_assigned_to IS NOT NULL AND p_assigned_to = c.profile_id)
      )
  );
$$;

COMMENT ON FUNCTION public.leads_row_writable(UUID, UUID) IS
  'True when authenticated user may insert or persist this lead row shape.';

REVOKE ALL ON FUNCTION public._caller_profile_for_leads() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.leads_row_accessible(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.leads_row_writable(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._caller_profile_for_leads() TO authenticated;
GRANT EXECUTE ON FUNCTION public.leads_row_accessible(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leads_row_writable(UUID, UUID) TO authenticated;

-- ─── RLS on leads ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS leads_select ON public.leads;
DROP POLICY IF EXISTS leads_insert ON public.leads;
DROP POLICY IF EXISTS leads_update ON public.leads;
DROP POLICY IF EXISTS leads_delete ON public.leads;

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads FORCE ROW LEVEL SECURITY;

CREATE POLICY leads_select ON public.leads
  FOR SELECT
  TO authenticated
  USING (public.leads_row_accessible(organization_id, assigned_to));

CREATE POLICY leads_insert ON public.leads
  FOR INSERT
  TO authenticated
  WITH CHECK (public.leads_row_writable(organization_id, assigned_to));

CREATE POLICY leads_update ON public.leads
  FOR UPDATE
  TO authenticated
  USING (public.leads_row_accessible(organization_id, assigned_to))
  WITH CHECK (public.leads_row_writable(organization_id, assigned_to));

CREATE POLICY leads_delete ON public.leads
  FOR DELETE
  TO authenticated
  USING (public.leads_row_accessible(organization_id, assigned_to));
