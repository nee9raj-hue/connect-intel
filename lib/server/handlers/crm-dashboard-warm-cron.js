import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { warmAllDashboardSnapshots } from '../dashboardWarm.js'
import { warmAllMeilisearch } from '../meiliWarm.js'
import { isSoloFreeInfra } from '../soloInfra.js'
import { meiliEnabled } from '../infra/config.js'

function isCronAuthorized(req, body) {
  if (req.headers['x-vercel-cron'] === '1') return true
  const secret = process.env.CRON_SECRET || process.env.MARKETING_CRON_SECRET
  if (!secret) return false
  const authHeader = req.headers?.authorization || ''
  const provided =
    authHeader.replace(/^Bearer\s+/i, '') || req.query?.secret || body?.secret
  return provided === secret
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'POST' && req.method !== 'GET') {
    return methodNotAllowed(res, ['GET', 'POST'])
  }

  if (isSoloFreeInfra()) {
    return sendJson(res, 200, { ok: true, skipped: true, reason: 'solo_free_infra' })
  }

  const body = req.method === 'POST' ? getBody(req) : {}

  const orgId = String(req.query?.org || req.query?.orgId || body?.orgId || '').trim() || null
  const nameQuery = String(req.query?.nameQuery || req.query?.name || body?.nameQuery || '').trim() || null
  const meiliOnly = req.query?.meili === '1' || body?.meili === true

  if (meiliOnly || (isSoloFreeInfra() && meiliEnabled())) {
    if (!isCronAuthorized(req, body)) {
      return sendJson(res, 401, { error: 'Unauthorized' })
    }
    try {
      const meilisearch = await warmAllMeilisearch({ orgId, nameQuery })
      return sendJson(res, 200, { ok: meilisearch.ok !== false, meilisearch })
    } catch (err) {
      console.error('meili warm failed:', err?.message || err)
      return sendJson(res, 500, { error: err.message || 'Meilisearch warm failed' })
    }
  }

  if (isSoloFreeInfra()) {
    return sendJson(res, 200, { ok: true, skipped: true, reason: 'solo_free_infra' })
  }

  if (!isCronAuthorized(req, body)) {
    return sendJson(res, 401, { error: 'Unauthorized' })
  }

  try {
    const [dashboard, meilisearch] = await Promise.all([
      warmAllDashboardSnapshots({ orgId }),
      meiliEnabled() ? warmAllMeilisearch({ orgId, nameQuery }) : Promise.resolve(null),
    ])
    return sendJson(res, 200, { ok: true, ...dashboard, meilisearch })
  } catch (err) {
    console.error('dashboard warm cron failed:', err?.message || err)
    return sendJson(res, 500, { error: err.message || 'Dashboard warm cron failed' })
  }
}
