import { redisGet, redisSet } from './redis.js'
import { isRedisEnabled } from './config.js'

const HEARTBEAT_KEY = 'ci:worker:heartbeat'
const HEARTBEAT_TTL_SEC = 90

export async function writeWorkerHeartbeat(meta = {}) {
  if (!isRedisEnabled()) return false
  const payload = JSON.stringify({
    at: new Date().toISOString(),
    pid: process.pid,
    ...meta,
  })
  return redisSet(HEARTBEAT_KEY, payload, { exSeconds: HEARTBEAT_TTL_SEC })
}

export async function readWorkerHeartbeat() {
  if (!isRedisEnabled()) {
    return { ok: false, error: 'redis_disabled' }
  }
  const raw = await redisGet(HEARTBEAT_KEY)
  if (!raw) {
    return { ok: false, error: 'no_heartbeat', stale: true }
  }
  try {
    const row = JSON.parse(raw)
    const ageMs = Date.now() - new Date(row.at).getTime()
    return {
      ok: ageMs < HEARTBEAT_TTL_SEC * 1000,
      ageMs,
      stale: ageMs >= HEARTBEAT_TTL_SEC * 1000,
      ...row,
    }
  } catch {
    return { ok: false, error: 'invalid_heartbeat' }
  }
}
