import { requireUser } from '../auth.js'
import { recordWorkspacePulse } from '../teamWorkspaceUsage.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])

  const user = await requireUser(req, res)
  if (!user) return

  const body = getBody(req)
  const panel = body?.panel ? String(body.panel).slice(0, 64) : null
  const leadId = body?.leadId ? String(body.leadId).slice(0, 64) : null

  const result = await recordWorkspacePulse(user.id, { panel, leadId })
  return sendJson(res, 200, result)
}
