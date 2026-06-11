import { requireUser } from '../auth.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { buildDashboardBootstrap } from '../dashboardBootstrap.js'
import { cacheGet, cacheSet } from '../infra/cache.js'

const TTL = 60
const STALE = 120

function cacheKey(user) {
  return `dashboard:bootstrap:${user.id}:${user.organizationId || 'solo'}`
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const user = await requireUser(req, res)
  if (!user) return

  const key = cacheKey(user)
  const cached = await cacheGet(key, { ttlSeconds: TTL, staleSeconds: STALE })
  if (cached.value && !cached.stale) {
    return sendJson(res, 200, { ...cached.value, _cache: { hit: true } })
  }

  try {
    const dashboard = await buildDashboardBootstrap(user)
    const payload = { dashboard, lastUpdated: dashboard.lastUpdated }
    void cacheSet(key, payload, { ttlSeconds: TTL })
    return sendJson(res, 200, { ...payload, _cache: { hit: false, stale: cached.stale } })
  } catch (error) {
    console.error('dashboard/bootstrap failed:', error)
    return sendJson(res, 500, { error: error.message || 'Could not load dashboard' })
  }
}
