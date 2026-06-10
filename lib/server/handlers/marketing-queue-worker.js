import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { processMarketingEmailQueue } from '../marketingEmailQueueWorker.js'

function authorize(req, body) {
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
  if (!authorize(req, body)) {
    return sendJson(res, 401, { error: 'Unauthorized' })
  }

  const limit = Math.min(200, Math.max(1, Number(body.limit || req.query?.limit) || 50))
  const maxMs = Math.min(280_000, Math.max(10_000, Number(body.maxMs) || 110_000))

  const result = await processMarketingEmailQueue({ limit, maxMs, workerId: body.workerId })
  return sendJson(res, 200, result)
}
