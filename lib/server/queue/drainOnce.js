import { isRedisEnabled } from '../infra/config.js'
import { processQueueJob } from './processors.js'
import { QUEUE_NAMES } from './names.js'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Process waiting jobs until queues are idle or maxMs elapses. */
export async function drainQueueJobsOnce({ maxMs = 54_000 } = {}) {
  if (!isRedisEnabled()) {
    return { ok: true, mode: 'redis_disabled', processed: [] }
  }

  const { Queue } = await import('bullmq')
  const { default: IORedis } = await import('ioredis')
  const url = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL
  const connection = new IORedis(url, { maxRetriesPerRequest: null, enableReadyCheck: false })

  const processed = []
  const started = Date.now()

  while (Date.now() - started < maxMs) {
    let ran = false

    for (const name of Object.values(QUEUE_NAMES)) {
      const queue = new Queue(name, { connection })
      const waiting = await queue.getJobs(['waiting'], 0, 0, true)
      const job = waiting[0]
      if (!job) continue
      ran = true
      try {
        const result = await processQueueJob(job)
        await job.moveToCompleted(JSON.stringify(result ?? null), 'queue-drain', false)
        processed.push({ queue: name, jobId: job.id, type: job.name, ok: true })
      } catch (error) {
        await job.moveToFailed(error, 'queue-drain', false)
        processed.push({ queue: name, jobId: job.id, type: job.name, ok: false, error: error.message })
      }
    }

    if (ran) continue

    let nextDelayMs = null
    for (const name of Object.values(QUEUE_NAMES)) {
      const queue = new Queue(name, { connection })
      const delayed = await queue.getJobs(['delayed'], 0, 0, true)
      for (const job of delayed) {
        const delay = Math.max(0, (job.timestamp || 0) + (job.delay || 0) - Date.now())
        if (nextDelayMs === null || delay < nextDelayMs) nextDelayMs = delay
      }
    }

    if (nextDelayMs === null) break
    const waitMs = Math.min(nextDelayMs + 50, maxMs - (Date.now() - started))
    if (waitMs <= 0) break
    await sleep(waitMs)
  }

  await connection.quit()
  return { ok: true, processed }
}
