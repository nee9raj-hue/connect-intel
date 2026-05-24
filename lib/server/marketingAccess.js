import { getOrganization } from './organizations.js'

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

export function getUserOrg(store, user) {
  if (!user.organizationId) return null
  return getOrganization(store, user.organizationId)
}
