import { requireUser, requireOrgAdmin } from '../auth.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { getRolePermissionMatrix, setRolePermission } from '../rolePermissions.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const user = await requireUser(req, res)
  if (!user) return

  if (user.accountType !== 'company' || !user.organizationId) {
    return sendJson(res, 403, { error: 'Company workspace required' })
  }

  try {
    if (req.method === 'GET') {
      const payload = await getRolePermissionMatrix(user.organizationId)
      return sendJson(res, 200, payload)
    }

    const admin = await requireOrgAdmin(req, res)
    if (!admin) return

    if (req.method === 'PUT' || req.method === 'PATCH') {
      const body = getBody(req)
      if (!body.role || !body.action) {
        return sendJson(res, 400, { error: 'role and action are required' })
      }
      const payload = await setRolePermission(user.organizationId, {
        role: body.role,
        action: body.action,
        allowed: body.allowed,
      })
      return sendJson(res, 200, payload)
    }

    return methodNotAllowed(res, ['GET', 'PUT', 'PATCH'])
  } catch (error) {
    console.error('org/permissions failed:', error)
    return sendJson(res, 400, { error: error.message || 'Permission update failed' })
  }
}
