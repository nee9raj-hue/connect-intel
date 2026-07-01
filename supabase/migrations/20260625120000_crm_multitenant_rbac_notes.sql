-- Org scope for JSON-backed master contacts/companies (store_collections metadata).
-- pipeline_leads already carries organization_id; this documents CRM multi-tenant alignment.

COMMENT ON TABLE public.pipeline_leads IS
  'Tenant-scoped pipeline rows; organization_id is required for company workspaces.';

COMMENT ON TABLE public.role_permissions IS
  'Per-org RBAC matrix (admin, manager, rep, marketing_*). Enforced in lib/server/permissionEnforce.js.';
