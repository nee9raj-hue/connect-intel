import { requireUser } from '../auth.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { normalizeDashboardPeriod } from '../dashboardPeriod.js'
import { cacheGet, cacheSet, activityTimelineCacheKey } from '../infra/cache.js'
import { readActivityTimelineSnapshot } from '../dashboardSnapshots.js'
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

  const row = await timeAsync('connectintel_activity_timeline', { period }, () =>
    readActivityTimelineSnapshot(user, { period, memberUserId })
  )

  const payload = {
    period,
    memberUserId: memberUserId ? String(memberUserId) : null,
    activityTimeline: row?.activityTimeline || [],
    recentActivities: row?.recentActivities || [],
    _snapshot: row ? { fresh: row.fresh, source: row.source, updatedAt: row.updatedAt } : null,
    warming: !row,
  }

  void cacheSet(cacheKey, payload, { ttlSeconds: TTL })

  return sendJson(res, 200, {
    ...payload,
    _cache: { hit: false, stale: cached.stale },
  })
}
