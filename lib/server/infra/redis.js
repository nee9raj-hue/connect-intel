import { getRedisUrl, getUpstashRestConfig, isRedisEnabled } from './config.js'

/** Upstash REST (serverless-safe) with in-memory fallback when Redis is not configured. */
const memoryStore = new Map()

function memKey(key) {
  return String(key)
}

async function upstashCommand(command) {
  const cfg = getUpstashRestConfig()
  if (!cfg) return null
  const res = await fetch(`${cfg.url}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(8_000),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    const quota = /max requests limit exceeded|quota/i.test(text)
    const err = new Error(`Redis REST error (${res.status}): ${text.slice(0, 200)}`)
    err.quotaExceeded = quota
    throw err
  }
  const data = await res.json()
  return data?.result
}

let ioredisClient = null

async function getIoRedis() {
  const url = getRedisUrl()
  if (!url) return null
  if (ioredisClient) return ioredisClient
  const { default: IORedis } = await import('ioredis')
  ioredisClient = new IORedis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
  })
  await ioredisClient.connect().catch(() => {})
  return ioredisClient
}

export async function redisGet(key) {
  if (!isRedisEnabled()) {
    const row = memoryStore.get(memKey(key))
    if (!row) return null
    if (row.expiresAt && row.expiresAt < Date.now()) {
      memoryStore.delete(memKey(key))
      return null
    }
    return row.value
  }

  const rest = getUpstashRestConfig()
  if (rest) {
    try {
      const raw = await upstashCommand(['GET', key])
      return raw == null ? null : String(raw)
    } catch (error) {
      if (error?.quotaExceeded) return null
      throw error
    }
  }

  const redis = await getIoRedis()
  if (!redis) return null
  return redis.get(key)
}

export async function redisSet(key, value, { exSeconds = null } = {}) {
  const payload = String(value)
  if (!isRedisEnabled()) {
    memoryStore.set(memKey(key), {
      value: payload,
      expiresAt: exSeconds ? Date.now() + exSeconds * 1000 : null,
    })
    return true
  }

  const rest = getUpstashRestConfig()
  if (rest) {
    const cmd = exSeconds ? ['SET', key, payload, 'EX', exSeconds] : ['SET', key, payload]
    await upstashCommand(cmd)
    return true
  }

  const redis = await getIoRedis()
  if (!redis) return false
  if (exSeconds) await redis.set(key, payload, 'EX', exSeconds)
  else await redis.set(key, payload)
  return true
}

export async function redisDel(key) {
  if (!isRedisEnabled()) {
    memoryStore.delete(memKey(key))
    return true
  }
  const rest = getUpstashRestConfig()
  if (rest) {
    await upstashCommand(['DEL', key])
    return true
  }
  const redis = await getIoRedis()
  if (!redis) return false
  await redis.del(key)
  return true
}

export async function testRedisConnection() {
  if (!isRedisEnabled()) {
    return { ok: false, mode: 'disabled', error: 'Redis not configured' }
  }
  const started = Date.now()
  try {
    const probe = `ci:ping:${Date.now()}`
    await redisSet(probe, '1', { exSeconds: 10 })
    const val = await redisGet(probe)
    await redisDel(probe)
    return {
      ok: val === '1',
      mode: getUpstashRestConfig() ? 'upstash-rest' : 'ioredis',
      latencyMs: Date.now() - started,
    }
  } catch (error) {
    return { ok: false, error: error.message, latencyMs: Date.now() - started }
  }
}
