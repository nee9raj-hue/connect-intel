import { requireUser } from '../auth.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { buildRepReviewPayload } from '../repReview.js'
import { cacheGet, cacheSet } from '../infra/cache.js'
import { canonicalActivityPeriod } from '../crmActivityScope.js'

const TTL = 45
const STALE = 120

function cacheKey(user, repUserId, period) {
  return `crm:rep-review:${user.organizationId || 'solo'}:${user.id}:${repUserId}:${period}`
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const user = await requireUser(req, res)
  if (!user) return

  const params = new URL(req.url || '', 'http://localhost').searchParams
  const repUserId = String(params.get('userId') || params.get('repUserId') || '').trim()
  const period = canonicalActivityPeriod(params.get('period') || '7d')
  const fresh = params.get('fresh') === '1'

  if (!repUserId) {
    return sendJson(res, 400, { error: 'userId is required' })
  }

  const key = cacheKey(user, repUserId, period)
  if (!fresh) {
    const cached = await cacheGet(key, { ttlSeconds: TTL, staleSeconds: STALE })
    if (cached.value && !cached.stale) {
      return sendJson(res, 200, { ...cached.value, _cache: { hit: true } })
    }
  }

  try {
    const payload = await buildRepReviewPayload(user, repUserId, { period })
    void cacheSet(key, payload, { ttlSeconds: TTL })
    return sendJson(res, 200, { ...payload, _cache: { hit: false } })
  } catch (error) {
    const status = /cannot view/i.test(error.message || '') ? 403 : 500
    return sendJson(res, status, { error: error.message || 'Could not load rep review' })
  }
}
