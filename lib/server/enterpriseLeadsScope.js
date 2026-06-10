import { isCompanyPipelineManager } from './organizations.js'

/** Admin/manager — org-wide pipeline (matches decrypted_leads / leads RLS). */
export function isEnterpriseLeadManager(user) {
  return isCompanyPipelineManager(user)
}

/** Sales rep — rows where assigned_to matches their profile. */
export function isEnterpriseLeadRep(user) {
  return Boolean(
    user?.accountType === 'company' &&
      user?.organizationId &&
      !isEnterpriseLeadManager(user)
  )
}

/**
 * Application-layer scope for service_role reads on decrypted_leads
 * (mirrors public.leads_row_accessible for admin/manager vs rep).
 */
export function resolveEnterpriseAssigneeFilter(user, filters = {}) {
  if (!user?.organizationId || user.accountType !== 'company') {
    return { mode: 'individual', legacyUserId: user?.id || null }
  }

  if (isEnterpriseLeadManager(user)) {
    const assignee = String(filters.assigneeUserId || '').trim()
    if (assignee === '__unassigned__') return { mode: 'org', unassigned: true }
    if (assignee) return { mode: 'org', legacyAssigneeUserId: assignee }
    return { mode: 'org' }
  }

  return { mode: 'rep', legacyUserId: user.id }
}
