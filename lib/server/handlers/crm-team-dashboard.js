import { requireUser } from '../auth.js'
import { buildTeamDashboard } from '../crmDashboard.js'
import { readStore } from '../store.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { loadPipelineStoreContext } from '../pipelineShard.js'
import { resolveTimeZone } from '../../calendarLocale.js'
import { normalizeDashboardPeriod, previousPeriodStart } from '../dashboardPeriod.js'
import { cacheGet, cacheSet, dashboardCacheKey } from '../infra/cache.js'
import { enqueueDashboardRefresh } from '../queue/producer.js'
import { timeAsync } from '../infra/metrics.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const user = await requireUser(req, res)
  if (!user) return

  const params = new URL(req.url || '', 'http://localhost').searchParams
  const period = normalizeDashboardPeriod(params.get('period'))
  const timeZone = resolveTimeZone(user, params.get('tz'))
  const memberUserId = params.get('userId') || null
  const mergeSinceMs = previousPeriodStart(period, timeZone)

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
  const cacheKey = dashboardCacheKey(user, { period, memberUserId, detailed })
  const cached = await cacheGet(cacheKey, { ttlSeconds: 60, staleSeconds: 180 })
  if (cached.value && !cached.stale) {
    return sendJson(res, 200, { ...cached.value, _cache: { hit: true, source: cached.source } })
  }

  const data = await timeAsync('connectintel_team_dashboard', { period }, () =>
    Promise.resolve(
      buildTeamDashboard(store, user, {
        period,
        memberUserId,
        light: true,
        detailed,
        timeZone,
      })
    )
  )

  void cacheSet(cacheKey, data, { ttlSeconds: 60 })
  if (cached.stale) {
    void enqueueDashboardRefresh(user.organizationId, user.id, period)
  }

  return sendJson(res, 200, { ...data, _cache: { hit: false, stale: cached.stale } })
}
