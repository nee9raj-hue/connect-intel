import { redisDel, redisGet, redisSet } from './redis.js'

const localCache = new Map()

function localGet(key) {
  const row = localCache.get(key)
  if (!row) return null
  if (row.expiresAt && row.expiresAt < Date.now()) {
    localCache.delete(key)
    return null
  }
  return row
}

/**
 * Stale-while-revalidate cache.
 * Returns { value, stale } — stale=true means caller may refresh in background.
 */
export async function cacheGet(key, { ttlSeconds = 60, staleSeconds = 120 } = {}) {
  const now = Date.now()
  const local = localGet(key)
  if (local) {
    const ageMs = now - local.fetchedAt
    if (ageMs < ttlSeconds * 1000) {
      return { value: local.value, stale: false, source: 'memory' }
    }
    if (ageMs < staleSeconds * 1000) {
      return { value: local.value, stale: true, source: 'memory-stale' }
    }
  }

  try {
    const raw = await redisGet(key)
    if (raw) {
      const parsed = JSON.parse(raw)
      const ageMs = now - (parsed.fetchedAt || 0)
      localCache.set(key, { value: parsed.value, fetchedAt: parsed.fetchedAt || now })
      if (ageMs < ttlSeconds * 1000) {
        return { value: parsed.value, stale: false, source: 'redis' }
      }
      if (ageMs < staleSeconds * 1000) {
        return { value: parsed.value, stale: true, source: 'redis-stale' }
      }
    }
  } catch {
    /* ignore parse/redis errors */
  }

  return { value: null, stale: false, source: 'miss' }
}

export async function cacheSet(key, value, { ttlSeconds = 60 } = {}) {
  const fetchedAt = Date.now()
  localCache.set(key, { value, fetchedAt, expiresAt: fetchedAt + ttlSeconds * 1000 })
  try {
    await redisSet(
      key,
      JSON.stringify({ value, fetchedAt }),
      { exSeconds: Math.max(ttlSeconds * 2, ttlSeconds + 30) }
    )
  } catch (err) {
    console.warn('cacheSet redis failed:', err?.message || err)
  }
}

export async function cacheInvalidate(prefixOrKey) {
  const key = String(prefixOrKey)
  localCache.delete(key)
  try {
    await redisDel(key)
  } catch {
    /* ignore */
  }
}

export function dashboardCacheKey(user, { period, memberUserId, detailed }) {
  const org = user?.organizationId || 'solo'
  const uid = user?.id || 'anon'
  const member = memberUserId || 'all'
  return `dash:${org}:${uid}:${period}:${member}:${detailed ? 'd' : 'l'}`
}

export function pipelineBootstrapCacheKey(user, query = {}, generation = 0) {
  const org = user?.organizationId || 'solo'
  const uid = user?.id || 'anon'
  const gen = Math.max(0, Number(generation) || 0)
  const parts = [
    String(gen),
    query.summaryOnly ? 's' : 'f',
    query.status || 'all',
    query.q || '',
    query.assigneeUserId || '',
    query.offset ?? 0,
    query.limit ?? 100,
    query.cursor || '',
    (query.cities || []).join(','),
    (query.states || []).join(','),
    query.followUpDue ? '1' : '0',
    query.overdueFollowUp ? '1' : '0',
    query.scope || '',
  ]
  return `pipe:bootstrap:${org}:${uid}:${parts.join(':')}`
}

export function pipelineSummaryCacheKey(shardName) {
  return `pipe:summary:${shardName}`
}

export function dashboardKpiCacheKey(user) {
  const org = user?.organizationId || 'solo'
  const uid = user?.id || 'anon'
  return `dash:kpi:${org}:${uid}`
}

export function teamMetricsCacheKey(user, period, memberUserId) {
  const org = user?.organizationId || 'solo'
  const uid = user?.id || 'anon'
  const member = memberUserId || 'all'
  return `dash:team:${org}:${uid}:${period}:${member}`
}

export function activityTimelineCacheKey(user, period, memberUserId) {
  const org = user?.organizationId || 'solo'
  const uid = user?.id || 'anon'
  const member = memberUserId || 'all'
  return `dash:activity:${org}:${uid}:${period}:${member}`
}

export function activityLogCacheKey(user, { period, memberUserId, activityType, limit, offset, status, tagId, from, to } = {}) {
  const org = user?.organizationId || 'solo'
  const uid = user?.id || 'anon'
  const member = memberUserId || 'all'
  const type = activityType || 'all'
  const lim = limit ?? 50
  const off = offset ?? 0
  const stage = status || 'all'
  const tag = tagId || 'all'
  const range = from && to ? `${from}_${to}` : period || 'week'
  return `dash:activity-log:${org}:${uid}:${range}:${member}:${type}:${stage}:${tag}:${lim}:${off}`
}

export function myDayCacheKey(user) {
  const uid = user?.id || 'anon'
  return `dash:myday:${uid}`
}

export function pipelineBootstrapGenKey(user) {
  const org = user?.organizationId || 'solo'
  const uid = user?.id || 'anon'
  return `pipe:bootstrap:gen:${org}:${uid}`
}

/** Bump after pipeline CRM mutations so sidebar status counts stay authoritative. */
export async function bumpPipelineBootstrapGeneration(user) {
  if (!user?.id) return 0
  const key = pipelineBootstrapGenKey(user)
  const current = await cacheGet(key, { ttlSeconds: 604_800, staleSeconds: 604_800 })
  const next = (Number(current.value) || 0) + 1
  await cacheSet(key, next, { ttlSeconds: 604_800 })
  return next
}

export async function getPipelineBootstrapGeneration(user) {
  if (!user?.id) return 0
  const key = pipelineBootstrapGenKey(user)
  const current = await cacheGet(key, { ttlSeconds: 604_800, staleSeconds: 604_800 })
  return Number(current.value) || 0
}
