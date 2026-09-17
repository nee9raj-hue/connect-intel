/**
 * Pipeline "owner" for filters, counts, and list display.
 * Matches pipeline_leads.owner_id (DB trigger): assignee when set, else saver.
 */
import { collectPipelineCollaboratorUserIds, entryHasUserCalendarItem } from './pipelineCollaborators.js'

export {
  collectPipelineCollaboratorUserIds,
  entryHasUserCalendarItem,
  refreshPipelineCollaboratorUserIds,
} from './pipelineCollaborators.js'
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

/**
 * Sales rep visibility: own leads (assignee or saver) plus rows with no owner yet.
 * Does not expose another rep's leads when assignee is null but savedBy is set.
 */
export function repPipelineEntryVisible(entry, userId, extraIds = []) {
  const ids = new Set(
    [userId, ...(Array.isArray(extraIds) ? extraIds : extraIds ? [extraIds] : [])]
      .map((id) => String(id || '').trim())
      .filter(Boolean)
  )
  if (!ids.size || !entry) return false
  const owner = pipelineOwnerUserId(entry)
  if (!owner) return isPipelineLeadUnassigned(entry)
  if (ids.has(owner)) return true
  if (ids.has(String(entry.assignedToUserId || '').trim())) return true
  if (collectPipelineCollaboratorUserIds(entry).some((id) => ids.has(String(id)))) return true
  if ([...ids].some((id) => entryHasUserCalendarItem(entry, id))) return true
  return false
}

/** Owner filter — excludes leads assigned to someone else even if saved-by differs. */
export function pipelineEntryMatchesOwnerFilter(entry, ownerUserId, extraIds = []) {
  if (!ownerUserId) return true
  if (ownerUserId === '__unassigned__') return isPipelineLeadUnassigned(entry)
  const ids = new Set(
    [ownerUserId, ...(Array.isArray(extraIds) ? extraIds : [])]
      .map((id) => String(id || '').trim())
      .filter((id) => id && id !== '__unassigned__')
  )
  const owner = pipelineOwnerUserId(entry)
  if (owner && ids.has(owner)) return true
  const assigned = String(entry?.assignedToUserId || '').trim()
  return Boolean(assigned && ids.has(assigned))
}
