const TTL_MS = 90_000
const cache = new Map()

export function getCalendarCache(query) {
  const hit = cache.get(query)
  if (!hit) return null
  if (Date.now() - hit.at > TTL_MS) {
    cache.delete(query)
    return null
  }
  return hit.data
}

export function setCalendarCache(query, data) {
  cache.set(query, { at: Date.now(), data })
}

export function clearCalendarCache() {
  cache.clear()
}
