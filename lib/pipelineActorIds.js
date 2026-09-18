import { normalizeOwnerName, ownerFirstNameKey } from './erpOwner.js'

/**
 * Login user id plus other org user records that are the same person
 * (same email, or ERP stub with the same first name).
 */
function firstNameSharedByOtherMembers(store, memberIds, first, ignoreIds) {
  for (const other of store?.users || []) {
    const otherId = String(other?.id || '')
    if (!otherId || ignoreIds.has(otherId)) continue
    if (!memberIds.has(otherId)) continue
    if (ownerFirstNameKey(other.name) === first) return true
  }
  return false
}

/** Login user id plus other org records that are the same person (email / unambiguous ERP stub). */
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
      const otherTokens = otherName.split(' ').filter(Boolean).length
      const selfTokens = nameKey.split(' ').filter(Boolean).length
      const prefix =
        (otherTokens >= 2 && nameKey.startsWith(`${otherName} `)) ||
        (selfTokens >= 2 && otherName.startsWith(`${nameKey} `))
      if (other.source === 'erp-owner') {
        if (otherName === nameKey || prefix) {
          ids.add(otherId)
          continue
        }
        if (
          otherTokens === 1 &&
          nameKey.startsWith(`${otherName} `) &&
          !firstNameSharedByOtherMembers(store, members, first, new Set([selfId, otherId]))
        ) {
          ids.add(otherId)
        }
        continue
      }
      if (prefix) ids.add(otherId)
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
