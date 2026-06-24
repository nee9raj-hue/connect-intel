-- Connect Intel — fix Supabase Security Advisor: crm_users must be SECURITY INVOKER
--
-- Without security_invoker, the view runs as the owner (postgres) and bypasses
-- RLS on public.profiles — exposing employees from all organizations to any caller.
-- Matches public.decrypted_leads pattern (20260615120000_decrypted_leads_view.sql).

DROP VIEW IF EXISTS public.crm_users;

CREATE VIEW public.crm_users
WITH (security_invoker = true)
AS
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

COMMENT ON VIEW public.crm_users IS
  'SECURITY INVOKER: RLS on public.profiles applies. App users (legacy_user_id = JSON store user id).';

REVOKE ALL ON public.crm_users FROM PUBLIC;
GRANT SELECT ON public.crm_users TO authenticated, service_role;

-- Smoke test (0 rows OK — verifies view parses under invoker semantics)
SELECT count(*)::int AS crm_users_rows FROM public.crm_users LIMIT 1;
