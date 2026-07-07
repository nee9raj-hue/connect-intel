import { createHash } from 'crypto'
import { cacheGet, cacheSet } from '../infra/cache.js'

const WEB_TTL = 900
const WEB_STALE = 1800

export function copilotWebCacheKey(userId, query) {
  const hash = createHash('sha256')
    .update(String(userId || ''))
    .update('|')
    .update(String(query || '').trim().toLowerCase())
    .digest('hex')
    .slice(0, 24)
  return `copilot:web:${hash}`
}

export async function getCachedWebResearch(userId, query) {
  const key = copilotWebCacheKey(userId, query)
  const cached = await cacheGet(key, { ttlSeconds: WEB_TTL, staleSeconds: WEB_STALE })
  return cached.value ? { ...cached.value, cacheHit: true } : null
}

export async function setCachedWebResearch(userId, query, payload) {
  const key = copilotWebCacheKey(userId, query)
  await cacheSet(key, payload, { ttlSeconds: WEB_TTL })
}
