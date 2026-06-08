import { requireUser } from '../auth.js'
import { listTeamMembers, updateMemberPermissions } from '../organizations.js'
import { readStore } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)
  if (req.method !== 'PATCH') return methodNotAllowed(res, ['PATCH'])

  const user = await requireUser(req, res)
  if (!user) return

  if (!user.isOrgAdmin || !user.organizationId) {
    return sendJson(res, 403, { error: 'Only your company admin can change permissions' })
  }

  const body = getBody(req)
  if (!body.userId) {
    return sendJson(res, 400, { error: 'userId is required' })
  }

  try {
    await updateMemberPermissions(user.organizationId, body.userId, {
      canSearch: body.canSearch,
      pipelineRole: body.pipelineRole,
      marketingRole: body.marketingRole,
    })
    const store = await readStore()
    return sendJson(res, 200, { members: listTeamMembers(store, user.organizationId) })
  } catch (error) {
    return sendJson(res, 400, { error: error.message || 'Update failed' })
  }
}
