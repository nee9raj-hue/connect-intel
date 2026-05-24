import { requireAdmin } from '../auth.js'
import { readStore } from '../store.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { buildSupportOverview } from '../platformSupport.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const user = await requireAdmin(req, res)
  if (!user) return

  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const store = await readStore()
  return sendJson(res, 200, buildSupportOverview(store))
}
