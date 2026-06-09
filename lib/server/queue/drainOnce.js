import { isRedisEnabled } from '../infra/config.js'
import { processQueueJob } from './processors.js'
import { QUEUE_NAMES } from './names.js'

/** Process at most one waiting job per queue (cron / safety-net friendly). */
export async function drainQueueJobsOnce() {
  if (!isRedisEnabled()) {
    return { ok: true, mode: 'redis_disabled', processed: [] }
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
      await job.moveToCompleted(JSON.stringify(result ?? null), 'queue-drain', false)
      processed.push({ queue: name, jobId: job.id, type: job.name, ok: true })
    } catch (error) {
      await job.moveToFailed(error, 'queue-drain', false)
      processed.push({ queue: name, jobId: job.id, type: job.name, ok: false, error: error.message })
    }
  }

  await connection.quit()
  return { ok: true, processed }
}
