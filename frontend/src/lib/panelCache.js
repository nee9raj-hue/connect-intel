/** Client-side stale-while-revalidate cache for heavy dashboard panels. */

const TTL_MS = 3 * 60 * 1000
const memory = new Map()

function storageKey(key) {
  return `ci-panel-cache:${key}`
}

export function readPanelCache(key, { maxAgeMs = TTL_MS } = {}) {
  const now = Date.now()
  const mem = memory.get(key)
  if (mem && now - mem.at < maxAgeMs) {
    return { data: mem.data, stale: false, at: mem.at }
  }

  try {
    const raw = sessionStorage.getItem(storageKey(key))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.data || !parsed?.at) return null
    const stale = now - parsed.at >= maxAgeMs
    memory.set(key, { data: parsed.data, at: parsed.at })
    return { data: parsed.data, stale, at: parsed.at }
  } catch {
    return null
  }
}

export function writePanelCache(key, data) {
  const at = Date.now()
  memory.set(key, { data, at })
  try {
    sessionStorage.setItem(storageKey(key), JSON.stringify({ data, at }))
  } catch {
    // quota / private mode
  }
}

export function teamReviewCacheKey(orgId, period) {
  return `team-review:${orgId || 'solo'}:${period || '7d'}`
}

export function repReviewCacheKey(orgId, userId, period) {
  return `rep-review:${orgId || 'solo'}:${userId}:${period || 'week'}`
}
