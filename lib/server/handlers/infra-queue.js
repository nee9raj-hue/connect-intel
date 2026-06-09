import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { isRedisEnabled } from '../infra/config.js'
import { testRedisConnection } from '../infra/redis.js'
import { readWorkerHeartbeat } from '../infra/workerHealth.js'
import { getQueueJobCounts } from '../infra/queueStats.js'
import { getEmailWorkerReadiness } from '../infra/emailWorkerPolicy.js'
import { QUEUE_NAMES } from '../queue/names.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const emailPolicy = getEmailWorkerReadiness()
  const redisTest = emailPolicy.redis ? await testRedisConnection() : { ok: false, mode: 'disabled' }
  const worker = emailPolicy.redis ? await readWorkerHeartbeat() : { ok: false, error: 'redis_disabled' }
  const queues = isRedisEnabled() ? await getQueueJobCounts() : { mode: 'disabled', queues: {} }

  const emailQ = queues.queues?.[QUEUE_NAMES.EMAIL] || {}
  const emailBacklog =
    (emailQ.waiting || 0) + (emailQ.delayed || 0) + (emailQ.active || 0)

  return sendJson(res, 200, {
    ok: redisTest.ok && worker.ok,
    apiVersion: '2026-06-email-v3',
    redis: redisTest,
    worker,
    email: {
      workerOnly: emailPolicy.workerOnly,
      backgroundEmail: emailPolicy.backgroundEmail,
      queueBacklog: emailBacklog,
      ready: emailPolicy.backgroundEmail && redisTest.ok && worker.ok,
    },
    queues,
  })
}
