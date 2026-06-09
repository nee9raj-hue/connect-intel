import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { drainQueueJobsOnce } from '../queue/drainOnce.js'
import { writeWorkerHeartbeat } from '../infra/workerHealth.js'

/** Manual / external cron hook for background queue drain (not on Vercel Hobby schedule). */
export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'POST' && req.method !== 'GET') {
    return methodNotAllowed(res, ['GET', 'POST'])
  }

  const secret = process.env.CRON_SECRET || process.env.MARKETING_CRON_SECRET
  const authHeader = req.headers?.authorization || ''
  const querySecret = req.query?.secret
  const bodySecret = getBody(req)?.secret
  const provided = authHeader.replace(/^Bearer\s+/i, '') || querySecret || bodySecret

  if (secret && provided !== secret) {
    return sendJson(res, 401, { error: 'Unauthorized' })
  }

  const result = await drainQueueJobsOnce()
  if (result.processed?.length) {
    await writeWorkerHeartbeat({ source: 'vercel_cron_drain', jobs: result.processed.length })
  }
  return sendJson(res, 200, result)
}
