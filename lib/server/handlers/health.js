import { getSupabaseEnvStatus, isSupabaseEnabled, testSupabaseConnection } from '../supabaseClient.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { getInfraStatus } from '../infra/config.js'
import { testRedisConnection } from '../infra/redis.js'
import { testMeilisearchConnection, getMeiliCircuitStatus } from '../meilisearch/client.js'
import { getCircuitStatus } from '../infra/circuitBreaker.js'
import { readWorkerHeartbeat } from '../infra/workerHealth.js'
import { getQueueJobCounts } from '../infra/queueStats.js'
import { getEmailWorkerReadiness } from '../infra/emailWorkerPolicy.js'
import { soloInfraStatus } from '../soloInfra.js'
import { getPlatform } from '../../platform/index.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const supabaseEnv = getSupabaseEnvStatus()
  const supabaseTest = await Promise.race([
    testSupabaseConnection(),
    new Promise((resolve) =>
      setTimeout(() => resolve({ ok: false, error: 'Supabase health check timed out (3s)' }), 3_000)
    ),
  ])

  const infra = getInfraStatus()
  const emailPolicy = getEmailWorkerReadiness()
  const redisTest = infra.redis ? await testRedisConnection() : { ok: false, mode: 'disabled' }
  const meiliTest = infra.meilisearch
    ? await testMeilisearchConnection()
    : { ok: false, error: 'disabled' }

  let worker = { ok: false, error: 'redis_disabled' }
  let queues = { mode: 'disabled', queues: {} }
  if (infra.redis) {
    try {
      worker = await readWorkerHeartbeat()
    } catch (error) {
      worker = { ok: false, error: String(error?.message || error).slice(0, 200) }
    }
    try {
      queues = await getQueueJobCounts()
    } catch (error) {
      queues = { mode: 'error', queues: {}, error: String(error?.message || error).slice(0, 200) }
    }
  }

  const emailQueue = queues.queues?.['ci-email'] || {}
  const emailBacklog =
    (emailQueue.waiting || 0) + (emailQueue.delayed || 0) + (emailQueue.active || 0)

  let platform = null
  try {
    platform = await getPlatform().health()
  } catch (error) {
    platform = { ok: false, error: error?.message || String(error) }
  }

  return sendJson(res, 200, {
    ok: true,
    apiVersion: '2026-06-email-v3',
    solo: soloInfraStatus(),
    infra,
    emailV3: {
      workerOnly: emailPolicy.workerOnly,
      ready: emailPolicy.workerOnly
        ? infra.backgroundEmail && redisTest.ok && worker.ok
        : infra.backgroundEmail && redisTest.ok,
    },
    readiness: {
      backgroundEmail: infra.backgroundEmail && redisTest.ok && worker.ok,
      search: infra.meilisearch && meiliTest.ok,
      worker: worker.ok,
      platformReady:
        infra.backgroundEmail &&
        redisTest.ok &&
        worker.ok &&
        infra.meilisearch &&
        meiliTest.ok &&
        supabaseTest.ok,
    },
    supabase: {
      configured: isSupabaseEnabled(),
      connected: supabaseTest.ok,
      env: supabaseEnv,
      error: supabaseTest.ok ? null : supabaseTest.error,
      circuit: getCircuitStatus(),
    },
    redis: redisTest,
    meilisearch: { ...meiliTest, circuit: getMeiliCircuitStatus() },
    worker: {
      ...worker,
      emailQueueBacklog: emailBacklog,
    },
    queues,
    platform,
    node: process.version,
  })
}
