import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { isRedisEnabled } from '../infra/config.js'
import { processQueueJob } from '../queue/processors.js'
import { QUEUE_NAMES } from '../queue/names.js'

/**
 * Safety-net job processor when dedicated workers are not running.
 * Processes at most one waiting job per queue per invocation (Vercel cron friendly).
 */
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

  if (!isRedisEnabled()) {
    return sendJson(res, 200, { ok: true, mode: 'redis_disabled', processed: [] })
  }

  const { Queue } = await import('bullmq')
  const { default: IORedis } = await import('ioredis')
  const url = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL
  const connection = new IORedis(url, { maxRetriesPerRequest: null, enableReadyCheck: false })

  const processed = []

  for (const name of Object.values(QUEUE_NAMES)) {
    const queue = new Queue(name, { connection })
    const waiting = await queue.getJobs(['waiting', 'delayed'], 0, 0, true)
    const job = waiting[0]
    if (!job) continue
    try {
      const result = await processQueueJob(job)
      await job.moveToCompleted(JSON.stringify(result ?? null), 'workers-cron', false)
      processed.push({ queue: name, jobId: job.id, type: job.name, ok: true })
    } catch (error) {
      await job.moveToFailed(error, 'workers-cron', false)
      processed.push({ queue: name, jobId: job.id, type: job.name, ok: false, error: error.message })
    }
  }

  await connection.quit()

  return sendJson(res, 200, { ok: true, processed })
}
