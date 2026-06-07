import { requireUser } from '../auth.js'
import { buildTeamDashboard } from '../crmDashboard.js'
import { readStore } from '../store.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { loadPipelineStoreContext } from '../pipelineShard.js'
import { normalizeDashboardPeriod } from '../dashboardPeriod.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const user = await requireUser(req, res)
  if (!user) return

  const params = new URL(req.url || '', 'http://localhost').searchParams
  const period = normalizeDashboardPeriod(params.get('period'))
  const memberUserId = params.get('userId') || null

  const [{ pipelineStore, visible }, intelMeta] = await Promise.all([
    loadPipelineStoreContext(user, { dashboard: true }),
    readStore({ only: ['searches', 'marketingCampaigns', 'users'] }),
  ])
  const store = {
    ...pipelineStore,
    savedLeads: visible,
    ...intelMeta,
    users: intelMeta.users?.length ? intelMeta.users : pipelineStore.users,
  }
  const data = buildTeamDashboard(store, user, { period, memberUserId, light: true })

  return sendJson(res, 200, data)
}
