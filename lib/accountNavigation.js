/** Resolve Accounts hub target from a pipeline lead row (shared browser + tests). */

export function companySlugFromName(name) {
  const key = String(name || '').trim().toLowerCase()
  if (!key) return null
  return key.replace(/[^a-z0-9]+/g, '_').slice(0, 80)
}

export function companyTargetFromLead(lead) {
  const companyName = String(lead?.company || '').trim()
  if (!companyName) return null
  const companyId = String(lead?.companyId || '').trim() || companySlugFromName(companyName)
  if (!companyId) return null
  return { companyId, companyName }
}
