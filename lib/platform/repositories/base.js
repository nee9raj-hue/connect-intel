/**
 * Tenant-scoped repository helpers.
 * Every query must include organizationId when applicable.
 */

export function assertOrgId(organizationId, label = 'organizationId') {
  const id = String(organizationId || '').trim()
  if (!id) throw new Error(`${label} is required for tenant-scoped access`)
  return id
}

export function scopeByOrg(rows, organizationId, { orgKey = 'organizationId' } = {}) {
  const org = assertOrgId(organizationId)
  return (rows || []).filter((row) => String(row?.[orgKey] || '') === org)
}

export function cacheKeyForOrg(prefix, organizationId, suffix = '') {
  const org = assertOrgId(organizationId)
  return `${prefix}:${org}${suffix ? `:${suffix}` : ''}`
}
