import { resolveOrgRole } from './organizations.js'
import { resolveManagerVisibleOwnerIds } from './pipelineManagerScope.js'
import { loadMemberProfilesMap } from './orgHierarchy.js'
import { loadOrgRepRoster, memberOptionsFromRepRoster } from './orgRepRoster.js'

/** rep | manager | org_admin */
export function resolveViewerRole(user, metaStore) {
  const { orgRole, membership } = resolveOrgRole(user, metaStore)
  if (user.isOrgAdmin || orgRole === 'org_admin') return 'org_admin'
  const pr = String(membership?.pipelineRole || user.pipelineRole || '').toLowerCase()
  if (pr === 'manager') return 'manager'
  return 'rep'
}

export function resolveViewerRoleFlags(user, metaStore) {
  const role = resolveViewerRole(user, metaStore)
  return {
    role,
    isAdmin: role === 'org_admin',
    isManager: role === 'manager',
    isRep: role === 'rep',
  }
}

/** Manager roster = visible owner ids + same-team members from hierarchy profiles. */
export async function expandManagerRosterIds(user, orgId, visibleOwnerIds, members = null) {
  const roster =
    members ||
    (orgId ? await loadOrgRepRoster(orgId, { userForIndex: user }) : [])
  const ids = new Set((visibleOwnerIds || [user.id]).map(String))
  const profileMap = orgId ? await loadMemberProfilesMap(orgId) : {}
  const managerTeamId = profileMap[user.id]?.teamId

  if (managerTeamId) {
    for (const m of roster) {
      const tid = profileMap[m.userId]?.teamId
      if (tid && String(tid) === String(managerTeamId)) ids.add(String(m.userId))
    }
  } else {
    for (const m of roster) {
      if (m.role !== 'org_admin' || m.pipelineRole === 'manager') ids.add(String(m.userId))
    }
  }
  return [...ids]
}

/**
 * Clamp requested member filter to what the viewer may see.
 * Reps → self only. Managers → self + team. Admins → anyone in org.
 */
export function clampScopedMemberId(user, metaStore, requestedMemberId, visibleOwnerIds) {
  const { isAdmin, isManager } = resolveViewerRoleFlags(user, metaStore)
  const mid = requestedMemberId ? String(requestedMemberId) : null
  if (!mid) return null
  if (isAdmin) return mid
  if (mid === String(user.id)) return mid
  if (isManager) {
    const allowed = new Set((visibleOwnerIds || []).map(String))
    if (allowed.has(mid)) return mid
  }
  return String(user.id)
}

/** Active members visible in dropdowns / team tables for this viewer. */
export async function loadViewerRoster(user, metaStore, { visibleOwnerIds = null } = {}) {
  const { role, isAdmin, isManager } = resolveViewerRoleFlags(user, metaStore)
  const orgId = user.organizationId

  if (!orgId) {
    const self = { userId: user.id, name: user.name || user.email || 'You', status: 'active' }
    return { role, isAdmin, isManager, rosterMembers: [self], memberOptions: [{ userId: self.userId, name: self.name }] }
  }

  const full = await loadOrgRepRoster(orgId, { userForIndex: user })

  if (isAdmin) {
    return { role, isAdmin, isManager, rosterMembers: full, memberOptions: memberOptionsFromRepRoster(full) }
  }

  if (isManager) {
    const ownerIds =
      visibleOwnerIds != null ? visibleOwnerIds : await resolveManagerVisibleOwnerIds(user, metaStore)
    const expanded = await expandManagerRosterIds(user, orgId, ownerIds, full)
    const allowed = new Set(expanded.map(String))
    const roster = full.filter((m) => allowed.has(String(m.userId)))
    return { role, isAdmin, isManager, rosterMembers: roster, memberOptions: memberOptionsFromRepRoster(roster) }
  }

  const self =
    full.find((m) => String(m.userId) === String(user.id)) || {
      userId: user.id,
      name: user.name || user.email || 'You',
      email: user.email,
      status: 'active',
    }
  return { role, isAdmin, isManager, rosterMembers: [self], memberOptions: memberOptionsFromRepRoster([self]) }
}

/**
 * Full viewer scope for dashboards, activity log, and team metrics.
 */
export async function resolveViewerScope(user, metaStore, { requestedMemberId = null } = {}) {
  const flags = resolveViewerRoleFlags(user, metaStore)
  const visibleOwnerIds = flags.isAdmin
    ? null
    : await resolveManagerVisibleOwnerIds(user, metaStore)

  const scopedMemberId = clampScopedMemberId(user, metaStore, requestedMemberId, visibleOwnerIds)
  const roster = await loadViewerRoster(user, metaStore, { visibleOwnerIds })

  return {
    ...flags,
    visibleOwnerIds,
    scopedMemberId,
    rosterMembers: roster.rosterMembers,
    memberOptions: roster.memberOptions,
  }
}
