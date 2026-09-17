/**
 * Company sidebar / panel access from Team → Permissions.
 * Org admins always have every action. Reps and managers only get what the matrix allows.
 */

export function userHasOrgNavPermission(user, action) {
  if (!user || !action) return false
  if (user.isPlatformAdmin || user.isOrgAdmin || user.orgRole === 'org_admin') return true
  if (!user.organizationId || user.accountType !== 'company') return true
  return Boolean(user.orgPermissions?.[action])
}

const PANEL_PERMISSION = {
  marketing: 'access_marketing',
  'crm-dashboard': 'view_analytics',
  'crm-log': 'view_analytics',
  team: 'manage_team',
}

/** False when a company rep/manager must not open this panel. */
export function isCustomerPanelAllowed(user, panel) {
  const id = String(panel || '').trim()
  if (!id) return true
  if (!user || user.isPlatformAdmin || user.isOrgAdmin || user.orgRole === 'org_admin') return true
  if (!user.organizationId || user.accountType !== 'company') return true
  if (id === 'crm-automation') return false
  if (id === 'search') return user.canSearch !== false
  const action = PANEL_PERMISSION[id]
  if (!action) return true
  return userHasOrgNavPermission(user, action)
}
