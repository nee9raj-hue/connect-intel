/**
 * Write-time tenant guards for pipeline JSON shards (multi-tenant CRM).
 */

export function stampPipelineEntryOrg(user, entry) {
  if (!entry || typeof entry !== 'object') return entry
  if (user?.organizationId && !entry.organizationId) {
    entry.organizationId = user.organizationId
  }
  return entry
}

export function assertPipelineStoreTenant(user, store) {
  if (!user?.organizationId) return
  const orgId = user.organizationId
  for (const entry of store?.savedLeads || []) {
    if (!entry) continue
    if (entry.organizationId && entry.organizationId !== orgId) {
      throw new Error('Cross-tenant pipeline write blocked')
    }
    if (!entry.organizationId) {
      entry.organizationId = orgId
    }
  }
}
