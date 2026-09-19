import { requireUser } from '../auth.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { loadMemberProfilesMap } from '../orgHierarchy.js'
import { loadOrgRepRoster, memberOptionsFromRepRoster } from '../orgRepRoster.js'
import { loadViewerRoster } from '../dashboardRoleScope.js'
import { listPendingOrgAccessRequests } from '../orgWorkspaceAccess.js'
import { loadOrgRosterFromSql, metaStoreFromSqlRoster } from '../orgRosterSql.js'
import { findOrganizationByLegacyId } from '../storeUserLookup.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const user = await requireUser(req, res)
  if (!user) return

  if (!user.organizationId || user.accountType !== 'company') {
    return sendJson(res, 200, { members: [], repRoster: [], memberOptions: [] })
  }

  try {
    const roster = await loadOrgRosterFromSql(user.organizationId)
    const meta = metaStoreFromSqlRoster(roster, user)
    const members =
      roster.members.length > 0
        ? roster.members
        : [
            {
              userId: user.id,
              name: user.name || user.email || 'You',
              email: user.email,
              role: user.isOrgAdmin ? 'org_admin' : 'member',
              pipelineRole: user.pipelineRole || (user.isOrgAdmin ? 'org_admin' : 'member'),
              status: 'active',
            },
          ]
    const [{ rosterMembers, memberOptions }, profileMap] = await Promise.all([
      loadViewerRoster(user, meta),
      loadMemberProfilesMap(user.organizationId),
    ])

    const enriched = members.map((m) => ({
      ...m,
      sqlRole: m.sqlRole || profileMap[m.userId]?.sqlRole || null,
      teamId: m.teamId || profileMap[m.userId]?.teamId || null,
      departmentId: m.departmentId || profileMap[m.userId]?.departmentId || null,
    }))

    const repRoster = rosterMembers?.length
      ? rosterMembers
      : await loadOrgRepRoster(user.organizationId, { userForIndex: user })

    let accessRequests = []
    if (user.isOrgAdmin) {
      try {
        const org = await findOrganizationByLegacyId(user.organizationId)
        accessRequests = listPendingOrgAccessRequests(
          { organizations: org ? [org] : [] },
          user.organizationId
        )
      } catch {
        accessRequests = []
      }
    }

    return sendJson(res, 200, {
      members: enriched,
      repRoster,
      memberOptions: memberOptions?.length ? memberOptions : memberOptionsFromRepRoster(repRoster),
      accessRequests,
    })
  } catch (error) {
    console.warn('team/members:', error?.message || error)
    const self = {
      userId: user.id,
      name: user.name || user.email || 'You',
      email: user.email,
      role: user.isOrgAdmin ? 'org_admin' : 'member',
      pipelineRole: user.pipelineRole || (user.isOrgAdmin ? 'org_admin' : 'member'),
      status: 'active',
    }
    return sendJson(res, 200, {
      members: [self],
      repRoster: [],
      memberOptions: [{ userId: self.userId, name: self.name }],
      accessRequests: [],
    })
  }
}
