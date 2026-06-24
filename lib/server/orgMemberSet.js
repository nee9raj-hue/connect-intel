import { getOrganization, listTeamMembers } from './organizations.js'

/** Active + inactive member user ids for an org (includes org owner). */
export function orgMemberUserIdSet(store, organizationId) {
  const ids = new Set()
  if (!organizationId) return ids
  for (const m of listTeamMembers(store, organizationId)) {
    if (m?.userId) ids.add(String(m.userId))
  }
  const org = getOrganization(store, organizationId)
  if (org?.ownerUserId) ids.add(String(org.ownerUserId))
  return ids
}

export function isOrgMemberUserId(store, organizationId, userId) {
  if (!userId || !organizationId) return false
  return orgMemberUserIdSet(store, organizationId).has(String(userId))
}
