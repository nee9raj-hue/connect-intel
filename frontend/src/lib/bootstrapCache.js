/** Client stale-while-revalidate cache for pipeline bootstrap (login + back navigation). */

const TTL_MS = 90 * 1000
const memory = new Map()

function storageKey(key) {
  return `ci-bootstrap-cache:${key}`
}

export function pipelineBootstrapCacheKey(user, { assigneeUserId, summaryOnly } = {}) {
  const org = user?.organizationId || 'solo'
  const uid = user?.id || 'anon'
  const assignee = assigneeUserId || 'all'
  return `pipeline:${org}:${uid}:${assignee}:${summaryOnly ? 'summary' : 'full'}`
}

export function readBootstrapCache(key, { maxAgeMs = TTL_MS } = {}) {
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

export function writeBootstrapCache(key, data) {
  const at = Date.now()
  memory.set(key, { data, at })
  try {
    sessionStorage.setItem(storageKey(key), JSON.stringify({ data, at }))
  } catch {
    // quota / private mode
  }
}

export function clearBootstrapCache(key) {
  memory.delete(key)
  try {
    sessionStorage.removeItem(storageKey(key))
  } catch {
    // ignore
  }
}
