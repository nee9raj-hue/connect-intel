import { getSupabaseEnvStatus, isSupabaseEnabled, testSupabaseConnection } from '../supabaseClient.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { getInfraStatus } from '../infra/config.js'
import { testRedisConnection } from '../infra/redis.js'
import { testMeilisearchConnection } from '../meilisearch/client.js'
import { getCircuitStatus } from '../infra/circuitBreaker.js'

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
  const redisTest = infra.redis ? await testRedisConnection() : { ok: false, mode: 'disabled' }
  const meiliTest = infra.meilisearch
    ? await testMeilisearchConnection()
    : { ok: false, error: 'disabled' }

  return sendJson(res, 200, {
    ok: true,
    apiVersion: '2026-06-09-infra',
    infra,
    supabase: {
      configured: isSupabaseEnabled(),
      connected: supabaseTest.ok,
      env: supabaseEnv,
      error: supabaseTest.ok ? null : supabaseTest.error,
      circuit: getCircuitStatus(),
    },
    redis: redisTest,
    meilisearch: meiliTest,
    node: process.version,
  })
}
