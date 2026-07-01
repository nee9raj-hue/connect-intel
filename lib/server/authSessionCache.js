/** Session user view cache — memory + Redis for cross-instance reuse. */

import { cacheGet, cacheSet, cacheInvalidate } from './infra/cache.js'

const SESSION_USER_CACHE_MS = 60_000
const SESSION_DB_REFRESH_MS = 5 * 60_000

const userViewCache = new Map()
const dbRefreshAt = new Map()

function sessionCacheKey(userId) {
  return `session:user:${userId}`
}

export function getCachedSessionUser(userId) {
  if (!userId) return null
  const hit = userViewCache.get(userId)
  if (!hit || Date.now() - hit.at >= SESSION_USER_CACHE_MS) return null
  return hit.user
}

export async function getCachedSessionUserDistributed(userId) {
  if (!userId) return null
  const local = getCachedSessionUser(userId)
  if (local) return local

  try {
    const cached = await cacheGet(sessionCacheKey(userId), {
      ttlSeconds: Math.floor(SESSION_USER_CACHE_MS / 1000),
      staleSeconds: Math.floor(SESSION_USER_CACHE_MS / 500),
    })
    if (cached.value) {
      userViewCache.set(userId, { user: cached.value, at: Date.now() })
      return cached.value
    }
  } catch {
    /* ignore redis errors */
  }
  return null
}

export function setCachedSessionUser(userId, user) {
  if (!userId || !user) return
  userViewCache.set(userId, { user, at: Date.now() })
  void cacheSet(sessionCacheKey(userId), user, {
    ttlSeconds: Math.floor(SESSION_USER_CACHE_MS / 1000),
  }).catch(() => {})
}

export function invalidateSessionUserCache(userId) {
  if (userId) {
    userViewCache.delete(userId)
    void cacheInvalidate(sessionCacheKey(userId)).catch(() => {})
  }
}

export function shouldRefreshSessionFromDatabase(userId) {
  if (!userId) return true
  const last = dbRefreshAt.get(userId) || 0
  return Date.now() - last >= SESSION_DB_REFRESH_MS
}

export function markSessionDatabaseRefreshed(userId, user) {
  if (!userId) return
  dbRefreshAt.set(userId, Date.now())
  if (user) setCachedSessionUser(userId, user)
}
