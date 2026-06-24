import { api } from './api'
import { buildActivityLogQuery } from './activityDashboardNav'
import { writePanelCache, repReviewCacheKey } from './panelCache'

const inflight = new Map()

/**
 * Warm rep review APIs on hover — scoped to one rep, no org bootstrap.
 */
export function prefetchRepReview(orgId, userId, period = 'week') {
  const uid = String(userId || '').trim()
  if (!uid) return Promise.resolve(null)

  const apiPeriod = period === '30d' || period === '7d' ? (period === '30d' ? 'month' : 'week') : period
  const cacheKey = repReviewCacheKey(orgId, uid, apiPeriod)
  if (inflight.has(cacheKey)) return inflight.get(cacheKey)

  const metricsQ = new URLSearchParams({ period: apiPeriod, userId: uid })
  const activityQ = buildActivityLogQuery({ period: apiPeriod, memberUserId: uid })

  const promise = Promise.all([
    api.getCrmRepSummary(uid, apiPeriod),
    api.getCrmTeamMetrics(metricsQ.toString()),
    api.getCrmActivityLog(`${activityQ}${activityQ ? '&' : ''}limit=200&offset=0`),
  ])
    .then(([summaryRes, metricsRes, activityRes]) => {
      const payload = {
        summary: summaryRes?.summary || null,
        metrics: metricsRes,
        activity: activityRes,
      }
      writePanelCache(cacheKey, payload)
      return payload
    })
    .catch(() => null)
    .finally(() => {
      inflight.delete(cacheKey)
    })

  inflight.set(cacheKey, promise)
  return promise
}
