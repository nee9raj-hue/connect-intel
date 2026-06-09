import { requireUser } from '../auth.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { readStore } from '../store.js'
import { cacheGet, cacheSet, dashboardKpiCacheKey } from '../infra/cache.js'
import { readDashboardKpi } from '../dashboardSnapshots.js'
import { timeAsync } from '../infra/metrics.js'

const TTL = 60
const STALE = 180

/** Fast org KPI strip — snapshot / pipeline index only (no full pipeline). */
export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const user = await requireUser(req, res)
  if (!user) return

  const cacheKey = dashboardKpiCacheKey(user)
  const cached = await cacheGet(cacheKey, { ttlSeconds: TTL, staleSeconds: STALE })
  if (cached.value && !cached.stale) {
    return sendJson(res, 200, { ...cached.value, _cache: { hit: true, source: cached.source } })
  }

  const meta = await readStore({ only: ['organizations', 'organizationMemberships', 'users'] })
  const store = { ...meta, savedLeads: [] }

  const result = await timeAsync('connectintel_dashboard_kpi', {}, () => readDashboardKpi(user, store))

  const payload = {
    kpi: result.kpi,
    snapshot: { fresh: result.fresh, source: result.source, updatedAt: result.updatedAt },
  }

  void cacheSet(cacheKey, payload, { ttlSeconds: TTL })

  return sendJson(res, 200, {
    ...payload,
    _cache: { hit: false, stale: cached.stale, prior: Boolean(cached.value) },
  })
}
