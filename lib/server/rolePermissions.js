import { isSupabaseEnabled, supabaseRest } from './supabaseClient.js'
import { resolveOrgUuid } from './enterpriseLeadsTable.js'

export const PERMISSION_ACTIONS = [
  { id: 'view_all_leads', label: 'View all leads' },
  { id: 'edit_leads', label: 'Edit leads' },
  { id: 'delete_leads', label: 'Delete leads' },
  { id: 'export_leads', label: 'Export leads' },
  { id: 'manage_team', label: 'Manage team' },
  { id: 'access_marketing', label: 'Access marketing hub' },
  { id: 'send_campaigns', label: 'Send campaigns' },
  { id: 'view_analytics', label: 'View analytics' },
  { id: 'manage_billing', label: 'Manage billing' },
]

export const PERMISSION_ROLES = ['admin', 'manager', 'rep', 'marketing_manager', 'marketing_executive']

const DEFAULT_MATRIX = {
  admin: {
    view_all_leads: true,
    edit_leads: true,
    delete_leads: true,
    export_leads: true,
    manage_team: true,
    access_marketing: true,
    send_campaigns: true,
    view_analytics: true,
    manage_billing: true,
  },
  manager: {
    view_all_leads: false,
    edit_leads: true,
    delete_leads: false,
    export_leads: true,
    manage_team: false,
    access_marketing: true,
    send_campaigns: true,
    view_analytics: true,
    manage_billing: false,
  },
  rep: {
    view_all_leads: false,
    edit_leads: true,
    delete_leads: false,
    export_leads: false,
    manage_team: false,
    access_marketing: false,
    send_campaigns: false,
    view_analytics: false,
    manage_billing: false,
  },
  marketing_manager: {
    view_all_leads: true,
    edit_leads: false,
    delete_leads: false,
    export_leads: true,
    manage_team: false,
    access_marketing: true,
    send_campaigns: true,
    view_analytics: true,
    manage_billing: false,
  },
  marketing_executive: {
    view_all_leads: false,
    edit_leads: false,
    delete_leads: false,
    export_leads: false,
    manage_team: false,
    access_marketing: true,
    send_campaigns: true,
    view_analytics: true,
    manage_billing: false,
  },
}

const orgCache = { orgs: new Map() }

export async function getRolePermissionMatrix(legacyOrgId) {
  const matrix = buildDefaultMatrix()

  if (!isSupabaseEnabled() || !legacyOrgId) {
    return { matrix, actions: PERMISSION_ACTIONS, roles: PERMISSION_ROLES, fromSql: false }
  }

  const orgUuid = await resolveOrgUuid(legacyOrgId, orgCache, { autoSync: true })
  if (!orgUuid) {
    return { matrix, actions: PERMISSION_ACTIONS, roles: PERMISSION_ROLES, fromSql: false }
  }

  const rows = await supabaseRest(
    `role_permissions?organization_id=eq.${encodeURIComponent(orgUuid)}&select=role,action,allowed`,
    {},
    { timeoutMs: 10_000 }
  )

  if (Array.isArray(rows)) {
    for (const row of rows) {
      if (matrix[row.role] && row.action in matrix[row.role]) {
        matrix[row.role][row.action] = Boolean(row.allowed)
      }
    }
  }

  return { matrix, actions: PERMISSION_ACTIONS, roles: PERMISSION_ROLES, fromSql: true }
}

function buildDefaultMatrix() {
  return JSON.parse(JSON.stringify(DEFAULT_MATRIX))
}

export async function setRolePermission(legacyOrgId, { role, action, allowed }) {
  if (!PERMISSION_ROLES.includes(role)) throw new Error('Invalid role')
  if (!PERMISSION_ACTIONS.some((a) => a.id === action)) throw new Error('Invalid action')

  const orgUuid = await resolveOrgUuid(legacyOrgId, orgCache, { autoSync: true })
  if (!orgUuid) throw new Error('Organization not synced to SQL')

  await supabaseRest(
    'role_permissions?on_conflict=organization_id,role,action',
    {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        organization_id: orgUuid,
        role,
        action,
        allowed: Boolean(allowed),
        updated_at: new Date().toISOString(),
      }),
    },
    { timeoutMs: 10_000 }
  )

  return getRolePermissionMatrix(legacyOrgId)
}
