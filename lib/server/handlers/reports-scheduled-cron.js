import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { processScheduledReportExports } from '../reportScheduledExport.js'
import { isSoloFreeInfra } from '../soloInfra.js'

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

  const body = req.method === 'POST' ? getBody(req) || {} : {}
  if (!isCronAuthorized(req, body)) {
    return sendJson(res, 401, { error: 'Unauthorized' })
  }

  try {
    const limit = Number(req.query?.limit || body.limit) || 25
    const payload = await processScheduledReportExports({ limit })
    return sendJson(res, 200, { ok: true, ...payload })
  } catch (error) {
    console.error('scheduled report cron failed:', error?.message || error)
    return sendJson(res, 500, { error: error.message || 'Scheduled report cron failed' })
  }
}
