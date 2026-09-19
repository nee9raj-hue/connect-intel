import { requireUser } from '../auth.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { loadOrgRosterFromSql, metaStoreFromSqlRoster } from '../orgRosterSql.js'
import { memberOptionsFromTeam } from '../teamMembersFresh.js'
import { resolveViewerRoleFlags } from '../dashboardRoleScope.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const user = await requireUser(req, res)
  if (!user) return

  if (!user.organizationId || user.accountType !== 'company') {
    return sendJson(res, 200, { members: [], repRoster: [], memberOptions: [] })
  }

  const self = {
    userId: user.id,
    name: user.name || user.email || 'You',
    email: user.email,
    role: user.isOrgAdmin ? 'org_admin' : 'member',
    pipelineRole: user.pipelineRole || (user.isOrgAdmin ? 'org_admin' : 'member'),
    status: 'active',
  }

  try {
    const roster = await loadOrgRosterFromSql(user.organizationId)
    const members = roster.members.length ? roster.members : [self]
    const meta = metaStoreFromSqlRoster(roster, user)
    const { isAdmin } = resolveViewerRoleFlags(user, meta)
    const visible = isAdmin
      ? members
      : members.filter((m) => String(m.userId) === String(user.id))
    const repRoster = visible.filter((m) => m.role !== 'org_admin' || m.pipelineRole === 'manager')

    return sendJson(res, 200, {
      members: visible,
      repRoster,
      memberOptions: memberOptionsFromTeam(repRoster.length ? repRoster : visible),
      accessRequests: [],
    })
  } catch (error) {
    console.warn('team/members:', error?.message || error)
    return sendJson(res, 200, {
      members: [self],
      repRoster: [],
      memberOptions: [{ userId: self.userId, name: self.name }],
      accessRequests: [],
    })
  }
}
