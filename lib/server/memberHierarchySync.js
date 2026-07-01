import { assignMemberHierarchy, orgHierarchyActive } from './orgHierarchy.js'
import { clearHierarchyProfileCache } from './pipelineHierarchyProfile.js'
import { deferMemberSqlSync, isOrgSqlSyncEnabled, syncOrgMembershipToSql } from './orgSqlSync.js'
import { readStore } from './store.js'

/** Map JSON store pipelineRole → SQL profiles.role */
export function mapPipelineRoleToSql(pipelineRole) {
  const r = String(pipelineRole || '').trim()
  if (r === 'org_admin') return 'admin'
  if (r === 'manager') return 'manager'
  return 'rep'
}

/** Ensure SQL profile exists, then patch hierarchy fields (team / department / role). */
export async function syncMemberSqlProfile(
  legacyOrgId,
  userId,
  { pipelineRole, sqlRole, teamId, departmentId, clearTeam, store: preloadedStore } = {}
) {
  if (!legacyOrgId || !userId) return

  if (isOrgSqlSyncEnabled()) {
    const store =
      preloadedStore ||
      (await readStore({ only: ['users', 'organizations', 'organizationMemberships'] }))
    await syncOrgMembershipToSql({ organizationId: legacyOrgId, userId, store })
  }

  if (!orgHierarchyActive()) return

  const patch = {}
  if (sqlRole) patch.role = sqlRole
  else if (pipelineRole !== undefined) patch.role = mapPipelineRoleToSql(pipelineRole)

  if (clearTeam) {
    patch.teamId = null
    patch.departmentId = null
  } else {
    if (teamId !== undefined) patch.teamId = teamId
    if (departmentId !== undefined) patch.departmentId = departmentId
  }

  if (!patch.role && patch.teamId === undefined && patch.departmentId === undefined) return

  await assignMemberHierarchy(legacyOrgId, { userId, ...patch })
  clearHierarchyProfileCache(userId)
}

/** Fire-and-forget profile sync after JSON membership changes. */
export function deferMemberHierarchySync(legacyOrgId, userId, patch, store) {
  void syncMemberSqlProfile(legacyOrgId, userId, { ...patch, store }).catch((error) => {
    console.warn('member hierarchy SQL sync:', error?.message || error)
  })
}

export { deferMemberSqlSync }
