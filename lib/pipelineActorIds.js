import { normalizeOwnerName, ownerFirstNameKey } from './erpOwner.js'

/**
 * Login user id plus other org user records that are the same person
 * (same email, or ERP stub with the same first name).
 */
export function listPipelineActorIds(store, organizationId, user) {
  const ids = new Set()
  const selfId = String(user?.id || '').trim()
  if (selfId) ids.add(selfId)
  if (!organizationId || !user) return [...ids]

  const email = String(user.email || '')
    .trim()
    .toLowerCase()
  const first = ownerFirstNameKey(user.name)
  const nameKey = normalizeOwnerName(user.name)
  const members = new Set(
    (store?.organizationMemberships || [])
      .filter((m) => m.organizationId === organizationId && m.status !== 'inactive')
      .map((m) => String(m.userId))
  )

  for (const other of store?.users || []) {
    const otherId = String(other?.id || '')
    if (!otherId || ids.has(otherId)) continue
    if (!members.has(otherId) && otherId !== selfId) continue
    const otherEmail = String(other.email || '')
      .trim()
      .toLowerCase()
    if (email && otherEmail && email === otherEmail) {
      ids.add(otherId)
      continue
    }
    const otherName = normalizeOwnerName(other.name)
    if (nameKey && otherName && nameKey === otherName) {
      ids.add(otherId)
      continue
    }
    const otherFirst = ownerFirstNameKey(other.name)
    if (first && otherFirst && first === otherFirst) {
      if (other.source === 'erp-owner') {
        ids.add(otherId)
        continue
      }
      if (nameKey.startsWith(`${otherName} `) || otherName.startsWith(`${nameKey} `)) {
        ids.add(otherId)
      }
    }
  }

  for (const extra of user.pipelineActorIds || []) {
    if (extra) ids.add(String(extra))
  }

  return [...ids]
}

/** Identity ids for a roster member id (login + ERP stub aliases). */
export function listPipelineActorIdsForMember(store, organizationId, memberId) {
  const id = String(memberId || '').trim()
  if (!id || id === '__unassigned__') return []
  const user = (store?.users || []).find((row) => String(row.id) === id)
  return listPipelineActorIds(store, organizationId, user || { id })
}

/** Expand Owner filter so admin/manager views include ERP aliases and sales-owner rows. */
export function withExpandedAssigneeFilter(filters, store, organizationId) {
  const assignee = String(filters?.assigneeUserId || '').trim()
  if (!assignee || assignee === '__unassigned__') return filters || {}
  const member = (store?.users || []).find((row) => String(row.id) === assignee) || null
  return {
    ...(filters || {}),
    assigneeActorIds: listPipelineActorIds(store, organizationId, member || { id: assignee }),
    assigneeMember: member,
  }
}
