/**
 * Pipeline "owner" for filters, counts, and list display.
 * Matches pipeline_leads.owner_id (DB trigger): assignee when set, else saver.
 */
export function pipelineOwnerUserId(entry) {
  if (!entry || typeof entry !== 'object') return null
  const assigned = entry.assignedToUserId
  if (assigned != null && String(assigned).trim() !== '') return String(assigned)
  const fallback = entry.savedByUserId || entry.userId
  return fallback != null && String(fallback).trim() !== '' ? String(fallback) : null
}

export function isPipelineLeadUnassigned(entry) {
  const assigned = entry?.assignedToUserId
  return assigned == null || String(assigned).trim() === ''
}

/** Owner filter — excludes leads assigned to someone else even if saved-by differs. */
export function pipelineEntryMatchesOwnerFilter(entry, ownerUserId) {
  if (!ownerUserId) return true
  if (ownerUserId === '__unassigned__') return isPipelineLeadUnassigned(entry)
  return pipelineOwnerUserId(entry) === String(ownerUserId)
}
