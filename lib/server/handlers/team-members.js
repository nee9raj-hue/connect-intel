import { requireUser } from '../auth.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { loadMemberProfilesMap } from '../orgHierarchy.js'
import { loadOrgTeamMembers } from '../teamMembersFresh.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const user = await requireUser(req, res)
  if (!user) return

  if (!user.organizationId || user.accountType !== 'company') {
    return sendJson(res, 200, { members: [] })
  }

  const members = await loadOrgTeamMembers(user.organizationId)
  const profileMap = await loadMemberProfilesMap(user.organizationId)

  const enriched = members.map((m) => ({
    ...m,
    sqlRole: profileMap[m.userId]?.sqlRole || null,
    teamId: profileMap[m.userId]?.teamId || null,
    departmentId: profileMap[m.userId]?.departmentId || null,
  }))

  return sendJson(res, 200, { members: enriched })
}
