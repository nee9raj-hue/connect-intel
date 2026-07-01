import { requireUser } from '../auth.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { buildRepSummary } from '../repSummary.js'
import { cacheGet, cacheSet } from '../infra/cache.js'
import { assertOrgPermission, permissionDeniedResponse } from '../permissionEnforce.js'
import { readStore } from '../store.js'

const TTL = 90
const STALE = 240

function cacheKey(user, repUserId, period) {
  return `crm:rep-summary:${user.organizationId || 'solo'}:${user.id}:${repUserId}:${period}`
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const user = await requireUser(req, res)
  if (!user) return

  const params = new URL(req.url || '', 'http://localhost').searchParams
  const repUserId = String(params.get('userId') || params.get('repUserId') || '').trim()
  const period = params.get('period') || 'week'

  if (!repUserId) {
    return sendJson(res, 400, { error: 'userId is required' })
  }

  if (
    user.organizationId &&
    user.accountType === 'company' &&
    String(repUserId) !== String(user.id)
  ) {
    const meta = await readStore({ only: ['users', 'organizations', 'organizationMemberships'] })
    try {
      await assertOrgPermission(user, 'view_analytics', meta)
    } catch (permError) {
      const denied = permissionDeniedResponse(permError)
      return sendJson(res, denied.status, denied.body)
    }
  }

  const key = cacheKey(user, repUserId, period)
  const cached = await cacheGet(key, { ttlSeconds: TTL, staleSeconds: STALE })
  if (cached.value && !cached.stale) {
    return sendJson(res, 200, { ...cached.value, _cache: { hit: true } })
  }

  try {
    const summary = await buildRepSummary(user, repUserId, { period })
    const payload = { summary, lastUpdated: summary.updatedAt }
    void cacheSet(key, payload, { ttlSeconds: TTL })
    return sendJson(res, 200, { ...payload, _cache: { hit: false } })
  } catch (error) {
    const status = /cannot view/i.test(error.message || '') ? 403 : 500
    return sendJson(res, status, { error: error.message || 'Could not load rep summary' })
  }
}
