import { requireUser } from '../auth.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { normalizeDashboardPeriod } from '../dashboardPeriod.js'
import { cacheGet, cacheSet, activityTimelineCacheKey } from '../infra/cache.js'
import { readActivityTimelineSnapshot } from '../dashboardSnapshots.js'
import { computeActivityTimelineLegacy } from '../dashboardLegacy.js'
import { timeAsync } from '../infra/metrics.js'

const TTL = 30
const STALE = 90

/** Activity feed / timeline — lazy-loaded after team summary. */
export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const user = await requireUser(req, res)
  if (!user) return

  const params = new URL(req.url || '', 'http://localhost').searchParams
  const period = normalizeDashboardPeriod(params.get('period'))
  const memberUserId = params.get('userId') || null

  const cacheKey = activityTimelineCacheKey(user, period, memberUserId)
  const cached = await cacheGet(cacheKey, { ttlSeconds: TTL, staleSeconds: STALE })
  if (cached.value && !cached.stale) {
    return sendJson(res, 200, { ...cached.value, _cache: { hit: true, source: cached.source } })
  }

  let activityTimeline = []
  let recentActivities = []
  let source = 'empty'

  const row = await readActivityTimelineSnapshot(user, { period, memberUserId })
  if (row) {
    activityTimeline = row.activityTimeline || []
    recentActivities = row.recentActivities || []
    source = row.source
  } else {
    try {
      const legacy = await timeAsync('connectintel_activity_timeline_legacy', { period }, () =>
        computeActivityTimelineLegacy(user, { period, memberUserId })
      )
      activityTimeline = legacy.activityTimeline || []
      recentActivities = legacy.recentActivities || []
      source = 'legacy_compute'
    } catch (error) {
      console.warn('activity-timeline legacy fallback failed:', error?.message || error)
    }
  }

  const payload = {
    period,
    memberUserId: memberUserId ? String(memberUserId) : null,
    activityTimeline,
    recentActivities,
    _snapshot: { source },
    warming: source === 'empty',
  }

  void cacheSet(cacheKey, payload, { ttlSeconds: TTL })

  return sendJson(res, 200, {
    ...payload,
    _cache: { hit: false, stale: cached.stale },
  })
}
