import { requireOrgAdmin } from '../auth.js'
import { listEmailSendsForOrg } from '../emailSends.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const user = await requireOrgAdmin(req, res)
  if (!user) return

  const params = new URL(req.url || '', 'http://localhost').searchParams
  const limit = Number(params.get('limit')) || 50
  const source = params.get('source') || null
  const leadId = params.get('leadId') || null

  try {
    const sends = await listEmailSendsForOrg(user.organizationId, { limit, source, leadId })
    return sendJson(res, 200, { sends, organizationId: user.organizationId })
  } catch (error) {
    return sendJson(res, 503, {
      sends: [],
      warning: error?.message || 'Email send log unavailable',
    })
  }
}
