import { isRedisEnabled } from './config.js'
import { QUEUE_NAMES } from '../queue/names.js'

let connection = null

async function getConnection() {
  if (!isRedisEnabled()) return null
  if (connection) return connection
  const url = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL
  if (!url) return null
  const { default: IORedis } = await import('ioredis')
  connection = new IORedis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
  })
  await connection.connect().catch(() => {})
  return connection
}

/** BullMQ job counts per queue — for health / Grafana. */
export async function getQueueJobCounts() {
  if (!isRedisEnabled()) {
    return { mode: 'disabled', queues: {} }
  }
  const conn = await getConnection()
  if (!conn) return { mode: 'unavailable', queues: {} }

  const { Queue } = await import('bullmq')
  const names = Object.values(QUEUE_NAMES)
  const queues = {}

  for (const name of names) {
    try {
      const queue = new Queue(name, { connection: conn })
      const counts = await queue.getJobCounts(
        'waiting',
        'active',
        'completed',
        'failed',
        'delayed',
        'paused'
      )
      queues[name] = counts
      await queue.close()
    } catch (error) {
      queues[name] = { error: String(error?.message || error).slice(0, 120) }
    }
  }

  return { mode: 'redis', queues }
}
