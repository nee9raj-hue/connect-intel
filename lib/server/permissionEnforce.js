import { getRolePermissionMatrix } from './rolePermissions.js'
import { resolveOrgRole } from './organizations.js'

/**
 * Map session user → role_permissions matrix role (HubSpot-style RBAC).
 * Super/platform admin → admin; org admin → admin; manager → manager; else rep.
 */
export function mapUserToPermissionRole(user, store) {
  if (!user) return 'rep'
  if (user.isPlatformAdmin) return 'admin'

  if (!user.organizationId || user.accountType === 'individual') {
    return 'admin'
  }

  const { orgRole, membership } = resolveOrgRole(user, store || {})
  if (orgRole === 'org_admin') return 'admin'

  const marketingRole = membership?.marketingRole
  if (marketingRole === 'marketing_manager') return 'marketing_manager'
  if (marketingRole === 'marketing_executive') return 'marketing_executive'

  const pipelineRole = user.pipelineRole || membership?.pipelineRole || 'member'
  if (pipelineRole === 'org_admin') return 'admin'
  if (pipelineRole === 'manager') return 'manager'
  return 'rep'
}

export async function userHasOrgPermission(user, action, store) {
  if (!user) return false
  if (user.isPlatformAdmin) return true

  if (!user.organizationId || user.accountType === 'individual') {
    return [
      'view_all_leads',
      'edit_leads',
      'delete_leads',
      'export_leads',
      'view_analytics',
      'access_marketing',
      'send_campaigns',
      'manage_team',
      'manage_billing',
    ].includes(action)
  }

  const role = mapUserToPermissionRole(user, store)
  const { matrix } = await getRolePermissionMatrix(user.organizationId)
  return Boolean(matrix[role]?.[action])
}

export async function assertOrgPermission(user, action, store) {
  const allowed = await userHasOrgPermission(user, action, store)
  if (!allowed) {
    const error = new Error('You do not have permission for this action')
    error.status = 403
    error.code = 'permission_denied'
    error.action = action
    throw error
  }
}

export function permissionDeniedResponse(error) {
  return {
    status: error?.status || 403,
    body: {
      error: error?.message || 'Permission denied',
      code: error?.code || 'permission_denied',
      action: error?.action || null,
    },
  }
}
