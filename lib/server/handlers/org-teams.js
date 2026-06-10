import { requireUser, requireOrgAdmin } from '../auth.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import {
  createTeam,
  deleteTeam,
  listOrgHierarchy,
  orgHierarchyActive,
  updateTeam,
} from '../orgHierarchy.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const user = await requireUser(req, res)
  if (!user) return

  if (user.accountType !== 'company' || !user.organizationId) {
    return sendJson(res, 403, { error: 'Company workspace required' })
  }

  if (!orgHierarchyActive()) {
    return sendJson(res, 503, { error: 'SQL hierarchy not available' })
  }

  try {
    if (req.method === 'GET') {
      const hierarchy = await listOrgHierarchy(user.organizationId)
      return sendJson(res, 200, hierarchy)
    }

    const admin = await requireOrgAdmin(req, res)
    if (!admin) return

    const body = getBody(req)
    const url = new URL(req.url || '', 'http://local')
    const id = String(body.id || url.searchParams.get('id') || '').trim()

    if (req.method === 'POST') {
      const team = await createTeam(user.organizationId, {
        departmentId: body.departmentId,
        name: body.name,
        managerLegacyUserId: body.managerLegacyUserId || body.managerUserId,
      })
      const hierarchy = await listOrgHierarchy(user.organizationId)
      return sendJson(res, 201, { team, ...hierarchy })
    }

    if (req.method === 'PATCH' || req.method === 'PUT') {
      if (!id) return sendJson(res, 400, { error: 'id is required' })
      const team = await updateTeam(user.organizationId, id, {
        name: body.name,
        departmentId: body.departmentId,
        managerLegacyUserId: body.managerLegacyUserId ?? body.managerUserId,
      })
      const hierarchy = await listOrgHierarchy(user.organizationId)
      return sendJson(res, 200, { team, ...hierarchy })
    }

    if (req.method === 'DELETE') {
      if (!id) return sendJson(res, 400, { error: 'id is required' })
      await deleteTeam(user.organizationId, id)
      const hierarchy = await listOrgHierarchy(user.organizationId)
      return sendJson(res, 200, { deleted: true, ...hierarchy })
    }

    return methodNotAllowed(res, ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'])
  } catch (error) {
    console.error('org/teams failed:', error)
    return sendJson(res, 400, { error: error.message || 'Team operation failed' })
  }
}
