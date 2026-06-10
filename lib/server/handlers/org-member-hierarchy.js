import { requireOrgAdmin } from '../auth.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { assignMemberHierarchy, listOrgHierarchy, orgHierarchyActive } from '../orgHierarchy.js'
import { clearHierarchyProfileCache } from '../pipelineHierarchyProfile.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'PATCH' && req.method !== 'PUT') {
    return methodNotAllowed(res, ['PATCH', 'PUT'])
  }

  const user = await requireOrgAdmin(req, res)
  if (!user) return

  if (!orgHierarchyActive()) {
    return sendJson(res, 503, { error: 'SQL hierarchy not available' })
  }

  try {
    const body = getBody(req)
    if (!body.userId) return sendJson(res, 400, { error: 'userId is required' })

    await assignMemberHierarchy(user.organizationId, {
      userId: body.userId,
      teamId: body.teamId,
      departmentId: body.departmentId,
      role: body.role,
    })

    clearHierarchyProfileCache(body.userId)

    const hierarchy = await listOrgHierarchy(user.organizationId)
    return sendJson(res, 200, hierarchy)
  } catch (error) {
    console.error('org/member-hierarchy failed:', error)
    return sendJson(res, 400, { error: error.message || 'Member assignment failed' })
  }
}
