import { getOrganization, getPipelineLeadIds } from './organizations.js'

export function requireMarketingUser(user) {
  if (!user?.id) return { ok: false, error: 'Sign in required' }
  return { ok: true, user }
}

export function marketingScopeKey(user) {
  if (user.organizationId) {
    return { organizationId: user.organizationId, createdByUserId: null }
  }
  return { organizationId: null, createdByUserId: user.id }
}

export function rowInMarketingScope(row, user) {
  if (!row || !user) return false
  if (user.organizationId) return row.organizationId === user.organizationId
  return row.createdByUserId === user.id && !row.organizationId
}

export function filterMarketingRows(rows, user) {
  return (rows || []).filter((row) => rowInMarketingScope(row, user))
}

/** Hide other reps' leads on shared org lists, campaigns, and enrollments. */
export function filterMarketingRowsForUser(store, user, rows) {
  const visibleLeadIds = getPipelineLeadIds(store, user)
  return filterMarketingRows(rows, user)
    .map((row) => {
      if (!Array.isArray(row.leadIds)) return row
      const leadIds = row.leadIds.filter((id) => visibleLeadIds.has(id))
      return { ...row, leadIds }
    })
    .filter((row) => !Array.isArray(row.leadIds) || row.leadIds.length > 0)
}

export function filterMarketingEnrollmentsForUser(store, user, rows) {
  const visibleLeadIds = getPipelineLeadIds(store, user)
  return filterMarketingRows(rows, user).filter((row) => visibleLeadIds.has(row.leadId))
}

export function getUserOrg(store, user) {
  if (!user.organizationId) return null
  return getOrganization(store, user.organizationId)
}
