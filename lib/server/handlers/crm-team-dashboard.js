import { requireUser } from '../auth.js'
import { buildTeamDashboard } from '../crmDashboard.js'
import { readStore } from '../store.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { loadPipelineStoreContext } from '../pipelineShard.js'
import { normalizeDashboardPeriod, previousPeriodStart } from '../dashboardPeriod.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const user = await requireUser(req, res)
  if (!user) return

  const params = new URL(req.url || '', 'http://localhost').searchParams
  const period = normalizeDashboardPeriod(params.get('period'))
  const memberUserId = params.get('userId') || null
  const mergeSinceMs = previousPeriodStart(period)

  const [{ pipelineStore, visible }, intelMeta] = await Promise.all([
    loadPipelineStoreContext(user, { mergeMonolithCrm: true, activitySinceMs: mergeSinceMs }),
    readStore({ only: ['searches', 'marketingCampaigns', 'users', 'organizationMemberships'] }),
  ])
  const store = {
    ...pipelineStore,
    ...intelMeta,
    savedLeads: visible,
    users: intelMeta.users?.length ? intelMeta.users : pipelineStore.users,
    organizationMemberships:
      intelMeta.organizationMemberships?.length
        ? intelMeta.organizationMemberships
        : pipelineStore.organizationMemberships,
  }
  const detailed = params.get('detailed') === '1'
  const data = buildTeamDashboard(store, user, { period, memberUserId, light: true, detailed })

  return sendJson(res, 200, data)
}
