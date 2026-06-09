import { requireUser } from '../auth.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { normalizeDashboardPeriod } from '../dashboardPeriod.js'
import { cacheGet, cacheSet, teamMetricsCacheKey } from '../infra/cache.js'
import { readTeamMetricsSnapshot, buildTeamMetricsWarmFallback } from '../dashboardSnapshots.js'
import { computeTeamMetricsLegacy } from '../dashboardLegacy.js'
import { timeAsync } from '../infra/metrics.js'
import { readStore } from '../store.js'
import { resolveTimeZone } from '../../calendarLocale.js'

const TTL = 60
const STALE = 180

/** Team intelligence summary — no activity timeline, no full pipeline read when snapshot exists. */
export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const user = await requireUser(req, res)
  if (!user) return

  const params = new URL(req.url || '', 'http://localhost').searchParams
  const period = normalizeDashboardPeriod(params.get('period'))
  const memberUserId = params.get('userId') || null
  const timeZone = resolveTimeZone(user, params.get('tz'))

  const cacheKey = teamMetricsCacheKey(user, period, memberUserId)
  const cached = await cacheGet(cacheKey, { ttlSeconds: TTL, staleSeconds: STALE })
  if (cached.value && !cached.stale) {
    return sendJson(res, 200, { ...cached.value, _cache: { hit: true, source: cached.source } })
  }

  const row = await readTeamMetricsSnapshot(user, { period, memberUserId })

  let payload
  if (row?.payload) {
    payload = {
      ...row.payload,
      _snapshot: { fresh: row.fresh, source: row.source },
    }
  } else {
    try {
      payload = await timeAsync('connectintel_team_metrics_legacy', { period }, () =>
        computeTeamMetricsLegacy(user, { period, memberUserId, detailed: false, timeZone })
      )
      payload._snapshot = { fresh: false, source: 'legacy_compute' }
    } catch (error) {
      console.warn('team-metrics legacy fallback failed:', error?.message || error)
      const meta = await readStore({ only: ['organizations', 'organizationMemberships', 'users'] })
      payload = await buildTeamMetricsWarmFallback(user, { ...meta, savedLeads: [] }, period)
    }
  }

  void cacheSet(cacheKey, payload, { ttlSeconds: TTL })

  return sendJson(res, 200, {
    ...payload,
    _cache: { hit: false, stale: cached.stale },
  })
}
