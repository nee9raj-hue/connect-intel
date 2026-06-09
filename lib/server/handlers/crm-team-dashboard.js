import { requireUser } from '../auth.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { normalizeDashboardPeriod } from '../dashboardPeriod.js'
import { cacheGet, cacheSet, dashboardCacheKey } from '../infra/cache.js'
import { readTeamMetricsSnapshot, readActivityTimelineSnapshot } from '../dashboardSnapshots.js'
import { computeTeamMetricsLegacy } from '../dashboardLegacy.js'
import { resolveTimeZone } from '../../calendarLocale.js'
import { timeAsync } from '../infra/metrics.js'

const TTL = 60
const STALE = 180

/**
 * Legacy combined team dashboard — cache-first, snapshot-only (no full pipeline on hot path).
 * Prefer split endpoints: /crm/team-metrics + /crm/activity-timeline
 */
export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const user = await requireUser(req, res)
  if (!user) return

  const params = new URL(req.url || '', 'http://localhost').searchParams
  const period = normalizeDashboardPeriod(params.get('period'))
  const memberUserId = params.get('userId') || null
  const detailed = params.get('detailed') === '1'
  const timeZone = resolveTimeZone(user, params.get('tz'))

  const cacheKey = dashboardCacheKey(user, { period, memberUserId, detailed })
  const cached = await cacheGet(cacheKey, { ttlSeconds: TTL, staleSeconds: STALE })
  if (cached.value && !cached.stale) {
    return sendJson(res, 200, { ...cached.value, _cache: { hit: true, source: cached.source } })
  }

  const teamRow = await timeAsync('connectintel_team_dashboard', { period }, () =>
    readTeamMetricsSnapshot(user, { period, memberUserId })
  )

  let payload
  if (teamRow?.payload) {
    payload = { ...teamRow.payload }
  } else {
    payload = await computeTeamMetricsLegacy(user, { period, memberUserId, detailed, timeZone })
  }

  if (detailed) {
    const timelineRow = await readActivityTimelineSnapshot(user, { period, memberUserId })
    if (timelineRow) {
      payload = {
        ...payload,
        activityTimeline: timelineRow.activityTimeline,
        recentActivities: timelineRow.recentActivities?.length
          ? timelineRow.recentActivities
          : payload.recentActivities,
      }
    }
  }

  if (teamRow?.payload) {
    payload._snapshot = { fresh: teamRow.fresh, source: teamRow.source }
  }

  void cacheSet(cacheKey, payload, { ttlSeconds: TTL })

  return sendJson(res, 200, {
    ...payload,
    _cache: { hit: false, stale: cached.stale },
  })
}
