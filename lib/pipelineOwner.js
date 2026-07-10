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
export function repPipelineEntryVisible(entry, userId) {
  const uid = String(userId || '').trim()
  if (!uid || !entry) return false
  const owner = pipelineOwnerUserId(entry)
  if (!owner) return isPipelineLeadUnassigned(entry)
  if (owner === uid) return true
  if (collectPipelineCollaboratorUserIds(entry).includes(uid)) return true
  if (entryHasUserCalendarItem(entry, uid)) return true
  return false
}

/** Owner filter — excludes leads assigned to someone else even if saved-by differs. */
export function pipelineEntryMatchesOwnerFilter(entry, ownerUserId) {
  if (!ownerUserId) return true
  if (ownerUserId === '__unassigned__') return isPipelineLeadUnassigned(entry)
  return pipelineOwnerUserId(entry) === String(ownerUserId)
}
