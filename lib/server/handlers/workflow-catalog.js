import { requireUser } from '../auth.js'
import { buildWorkflowCatalog } from '../workflowCatalog.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const user = await requireUser(req, res)
  if (!user) return

  return sendJson(res, 200, buildWorkflowCatalog())
}
