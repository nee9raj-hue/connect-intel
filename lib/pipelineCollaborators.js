import { normalizeParticipantIds } from './participantIds.js'

function pipelineOwnerFromEntry(entry) {
  const assigned = entry?.assignedToUserId
  if (assigned != null && String(assigned).trim() !== '') return String(assigned)
  const fallback = entry?.savedByUserId || entry?.userId
  return fallback != null && String(fallback).trim() !== '' ? String(fallback) : null
}

/** Task/meeting participants on a pipeline entry (excluding lead owner). */
export function collectPipelineCollaboratorUserIds(entry) {
  const ids = new Set()
  for (const raw of entry?.collaboratorUserIds || []) {
    const id = String(raw || '').trim()
    if (id) ids.add(id)
  }

  const crm = entry?.crm && typeof entry.crm === 'object' ? entry.crm : {}
  for (const task of crm.tasks || []) {
    for (const id of normalizeParticipantIds(task.assignedToUserId, task.participantUserIds)) {
      ids.add(id)
    }
  }
  for (const meeting of crm.meetings || []) {
    for (const id of normalizeParticipantIds(meeting.assignedToUserId, meeting.participantUserIds)) {
      ids.add(id)
    }
  }

  const owner = pipelineOwnerFromEntry(entry)
  if (owner) ids.delete(owner)
  return [...ids]
}

export function entryHasUserCalendarItem(entry, userId) {
  const crm = entry?.crm && typeof entry.crm === 'object' ? entry.crm : {}
  for (const t of crm.tasks || []) {
    if (t?.completed) continue
    if (normalizeParticipantIds(t.assignedToUserId, t.participantUserIds).includes(userId)) {
      return true
    }
  }
  for (const m of crm.meetings || []) {
    if (normalizeParticipantIds(m.assignedToUserId, m.participantUserIds).includes(userId)) {
      return true
    }
  }
  return false
}

export function refreshPipelineCollaboratorUserIds(entry) {
  if (!entry || typeof entry !== 'object') return []
  const ids = collectPipelineCollaboratorUserIds(entry)
  entry.collaboratorUserIds = ids
  return ids
}
