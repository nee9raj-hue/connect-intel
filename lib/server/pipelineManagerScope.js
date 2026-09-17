import { loadMemberProfilesMap, listOrgHierarchy } from './orgHierarchy.js'
import { loadHierarchyProfile } from './pipelineHierarchyProfile.js'
import { resolveOrgRole } from './organizations.js'
import { isPipelineHierarchyRbacEnabled } from './infra/config.js'

/** True when user is a sales manager (not company admin). */
export function isPipelineTeamManager(user, store) {
  if (!user?.organizationId || user.accountType !== 'company') return false
  const { orgRole, membership } = resolveOrgRole(user, store)
  if (orgRole === 'org_admin') return false
  const pr = String(membership?.pipelineRole || user.pipelineRole || '').toLowerCase()
  return pr === 'manager'
}

export async function loadManagedTeamIds(legacyOrgId, userId) {
  if (!legacyOrgId || !userId) return []
  try {
    const hierarchy = await listOrgHierarchy(legacyOrgId, { skipLeadCounts: true })
    const ids = []
    for (const dept of hierarchy?.departments || []) {
      for (const team of dept.teams || []) {
        const managerId = team.managerLegacyUserId || team.managerUserId
        if (managerId && String(managerId) === String(userId)) ids.push(String(team.id))
      }
    }
    return ids
  } catch {
    return []
  }
}

/**
 * Legacy user ids whose pipeline rows a manager may view.
 * null = org-wide (admin). Array = explicit owner allow-list.
 */
export async function resolveManagerVisibleOwnerIds(user, metaStore, profileHint = null) {
  const { orgRole, accountType, membership } = resolveOrgRole(user, metaStore)
  if (accountType !== 'company' || !user.organizationId) return [user.id]
  if (orgRole === 'org_admin') return null

  let role = 'rep'
  let teamId = null

  const profile =
    profileHint ||
    (isPipelineHierarchyRbacEnabled() ? await loadHierarchyProfile(user, metaStore) : null)

  if (profile?.role === 'admin') return null
  if (profile?.role === 'manager') role = 'manager'
  if (membership?.pipelineRole === 'manager') role = 'manager'
  if (String(profile?.pipelineRole || '').toLowerCase() === 'manager') role = 'manager'
  teamId = profile?.teamId || user.teamId || null

  if (role !== 'manager') return [user.id]

  const ids = new Set([user.id])
  const managed = new Set(await loadManagedTeamIds(user.organizationId, user.id))
  if (teamId) managed.add(String(teamId))

  const map = await loadMemberProfilesMap(user.organizationId)
  for (const [uid, p] of Object.entries(map)) {
    if (p.teamId && managed.has(String(p.teamId))) ids.add(uid)
  }
  return [...ids]
}
