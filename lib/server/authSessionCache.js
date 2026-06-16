/** Short-lived per-user session view cache — cuts PostgREST auth reads under concurrent API traffic. */

const SESSION_USER_CACHE_MS = 60_000
const SESSION_DB_REFRESH_MS = 5 * 60_000

const userViewCache = new Map()
const dbRefreshAt = new Map()

export function getCachedSessionUser(userId) {
  if (!userId) return null
  const hit = userViewCache.get(userId)
  if (!hit || Date.now() - hit.at >= SESSION_USER_CACHE_MS) return null
  return hit.user
}

export function setCachedSessionUser(userId, user) {
  if (!userId || !user) return
  userViewCache.set(userId, { user, at: Date.now() })
}

export function invalidateSessionUserCache(userId) {
  if (userId) userViewCache.delete(userId)
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
