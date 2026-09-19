import { requireUser } from '../auth.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { loadMemberProfilesMap } from '../orgHierarchy.js'
import { loadOrgTeamMembers } from '../teamMembersFresh.js'
import { loadOrgRepRoster, memberOptionsFromRepRoster } from '../orgRepRoster.js'
import { loadViewerRoster } from '../dashboardRoleScope.js'
import { listPendingOrgAccessRequests } from '../orgWorkspaceAccess.js'
import { SESSION_STORE_COLLECTIONS, readStore } from '../store.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const user = await requireUser(req, res)
  if (!user) return

  if (!user.organizationId || user.accountType !== 'company') {
    return sendJson(res, 200, { members: [], repRoster: [], memberOptions: [] })
  }

  const meta = await readStore({
    only: SESSION_STORE_COLLECTIONS,
    timeoutMs: 8_000,
    attempts: 2,
  })
  const [{ rosterMembers, memberOptions }, members, profileMap] = await Promise.all([
    loadViewerRoster(user, meta),
    loadOrgTeamMembers(user.organizationId, { store: meta }),
    loadMemberProfilesMap(user.organizationId),
  ])

  const enriched = members.map((m) => ({
    ...m,
    sqlRole: profileMap[m.userId]?.sqlRole || null,
    teamId: profileMap[m.userId]?.teamId || null,
    departmentId: profileMap[m.userId]?.departmentId || null,
  }))

  const repRoster = rosterMembers?.length
    ? rosterMembers
    : await loadOrgRepRoster(user.organizationId, { userForIndex: user })

  return sendJson(res, 200, {
    members: enriched,
    repRoster,
    memberOptions: memberOptions?.length ? memberOptions : memberOptionsFromRepRoster(repRoster),
    accessRequests:
      user.isOrgAdmin && user.accountType === 'company'
        ? listPendingOrgAccessRequests(meta, user.organizationId)
        : [],
  })
}
