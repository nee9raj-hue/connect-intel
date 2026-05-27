import { requireUser } from '../auth.js'
import { buildTeamDashboard } from '../crmDashboard.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { loadPipelineStoreContext } from '../pipelineShard.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const user = await requireUser(req, res)
  if (!user) return

  const params = new URL(req.url || '', 'http://localhost').searchParams
  const period = params.get('period') === 'month' ? 'month' : 'week'
  const memberUserId = params.get('userId') || null

  const { pipelineStore } = await loadPipelineStoreContext(user)
  const data = buildTeamDashboard(pipelineStore, user, { period, memberUserId })

  return sendJson(res, 200, data)
}
