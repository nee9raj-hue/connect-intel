import { assignMemberHierarchy, orgHierarchyActive } from './orgHierarchy.js'
import { clearHierarchyProfileCache } from './pipelineHierarchyProfile.js'

/** Map JSON store pipelineRole → SQL profiles.role */
export function mapPipelineRoleToSql(pipelineRole) {
  const r = String(pipelineRole || '').trim()
  if (r === 'org_admin') return 'admin'
  if (r === 'manager') return 'manager'
  return 'rep'
}

/** Keep profiles.role / team in sync after membership changes. */
export async function syncMemberSqlProfile(
  legacyOrgId,
  userId,
  { pipelineRole, sqlRole, teamId, departmentId, clearTeam } = {}
) {
  if (!orgHierarchyActive() || !legacyOrgId || !userId) return

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
