import { api } from './api'
import { canonicalActivityPeriod } from './crmActivityScope'
import { writePanelCache, repReviewCacheKey } from './panelCache'

const inflight = new Map()

/** Warm unified rep review on hover — one API, one period scope. */
export function prefetchRepReview(orgId, userId, period = '7d') {
  const uid = String(userId || '').trim()
  if (!uid) return Promise.resolve(null)

  const periodNorm = canonicalActivityPeriod(period)
  const cacheKey = repReviewCacheKey(orgId, uid, periodNorm)
  if (inflight.has(cacheKey)) return inflight.get(cacheKey)

  const promise = api
    .getCrmRepReview(uid, periodNorm)
    .then((review) => {
      writePanelCache(cacheKey, { review })
      return review
    })
    .catch(() => null)
    .finally(() => {
      inflight.delete(cacheKey)
    })

  inflight.set(cacheKey, promise)
  return promise
}
