import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { warmAllMeilisearch } from '../meiliWarm.js'
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

  const body = req.method === 'POST' ? getBody(req) : {}
  if (!isCronAuthorized(req, body)) {
    return sendJson(res, 401, { error: 'Unauthorized' })
  }

  if (!meiliEnabled()) {
    return sendJson(res, 503, {
      ok: false,
      skipped: true,
      reason: 'meilisearch_not_configured',
    })
  }

  const orgId = String(req.query?.org || req.query?.orgId || body?.orgId || '').trim() || null
  const nameQuery = String(req.query?.nameQuery || req.query?.name || body?.nameQuery || '').trim() || null

  try {
    const result = await warmAllMeilisearch({ orgId, nameQuery })
    return sendJson(res, 200, { ok: result.ok !== false, ...result })
  } catch (err) {
    console.error('meili sync cron failed:', err?.message || err)
    return sendJson(res, 500, { error: err.message || 'Meilisearch sync cron failed' })
  }
}
