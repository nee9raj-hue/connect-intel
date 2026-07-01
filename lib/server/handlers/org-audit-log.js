import { requireOrgAdmin } from '../auth.js'
import { listAuditEventsForOrg } from '../auditEvents.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const user = await requireOrgAdmin(req, res)
  if (!user) return

  const params = new URL(req.url || '', 'http://localhost').searchParams
  const limit = Number(params.get('limit')) || 50
  const action = params.get('action') || null

  try {
    const events = await listAuditEventsForOrg(user.organizationId, { limit, action })
    return sendJson(res, 200, { events, organizationId: user.organizationId })
  } catch (error) {
    return sendJson(res, 503, {
      events: [],
      warning: error?.message || 'Audit log unavailable',
    })
  }
}
