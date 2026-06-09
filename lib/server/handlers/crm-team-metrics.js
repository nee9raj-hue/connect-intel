import { requireUser } from '../auth.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { normalizeDashboardPeriod } from '../dashboardPeriod.js'
import { cacheGet, cacheSet, teamMetricsCacheKey } from '../infra/cache.js'
import { readTeamMetricsSnapshot, buildTeamMetricsWarmFallback } from '../dashboardSnapshots.js'
import { readStore } from '../store.js'
import { timeAsync } from '../infra/metrics.js'

const TTL = 60
const STALE = 180

/** Team intelligence summary — no activity timeline, no full pipeline read. */
export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const user = await requireUser(req, res)
  if (!user) return

  const params = new URL(req.url || '', 'http://localhost').searchParams
  const period = normalizeDashboardPeriod(params.get('period'))
  const memberUserId = params.get('userId') || null

  const cacheKey = teamMetricsCacheKey(user, period, memberUserId)
  const cached = await cacheGet(cacheKey, { ttlSeconds: TTL, staleSeconds: STALE })
  if (cached.value && !cached.stale) {
    return sendJson(res, 200, { ...cached.value, _cache: { hit: true, source: cached.source } })
  }

  const row = await timeAsync('connectintel_team_metrics', { period }, () =>
    readTeamMetricsSnapshot(user, { period, memberUserId })
  )

  let payload
  if (!row?.payload) {
    const meta = await readStore({ only: ['organizations', 'organizationMemberships', 'users'] })
    payload = await buildTeamMetricsWarmFallback(user, { ...meta, savedLeads: [] }, period)
  } else {
    payload = {
      ...row.payload,
      _snapshot: { fresh: row.fresh, source: row.source },
    }
  }

  void cacheSet(cacheKey, payload, { ttlSeconds: TTL })

  return sendJson(res, 200, {
    ...payload,
    _cache: { hit: false, stale: cached.stale },
  })
}
