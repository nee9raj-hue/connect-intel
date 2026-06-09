import { getMeilisearchConfig, isMeilisearchEnabled } from '../infra/config.js'

export function meiliEnabled() {
  return isMeilisearchEnabled()
}

async function meiliFetch(path, options = {}) {
  const cfg = getMeilisearchConfig()
  if (!cfg) throw new Error('Meilisearch not configured')
  const url = `${cfg.host}${path.startsWith('/') ? path : `/${path}`}`
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    signal: AbortSignal.timeout(options.timeoutMs || 15_000),
  })
  const text = await res.text()
  let data = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }
  if (!res.ok) {
    throw new Error(data?.message || data?.error || `Meilisearch ${res.status}`)
  }
  return data
}

export async function ensureMeilisearchIndex(uid, primaryKey = 'id') {
  if (!meiliEnabled()) return false
  try {
    await meiliFetch(`/indexes/${uid}`)
    return true
  } catch {
    await meiliFetch('/indexes', {
      method: 'POST',
      body: JSON.stringify({ uid, primaryKey }),
    })
    await meiliFetch(`/indexes/${uid}/settings`, {
      method: 'PATCH',
      body: JSON.stringify({
        searchableAttributes: [
          'name',
          'email',
          'company',
          'title',
          'phone',
          'city',
          'state',
          'notes',
        ],
        filterableAttributes: ['organizationId', 'type', 'status', 'assignedToUserId'],
        sortableAttributes: ['updatedAt'],
      }),
    })
    return true
  }
}

export async function meiliUpsertDocuments(indexUid, documents) {
  if (!meiliEnabled() || !documents?.length) return null
  await ensureMeilisearchIndex(indexUid)
  return meiliFetch(`/indexes/${indexUid}/documents`, {
    method: 'POST',
    body: JSON.stringify(documents),
  })
}

export async function meiliDeleteDocuments(indexUid, filter) {
  if (!meiliEnabled()) return null
  return meiliFetch(`/indexes/${indexUid}/documents/delete`, {
    method: 'POST',
    body: JSON.stringify({ filter }),
  })
}

export async function meiliSearch(indexUid, { q, limit = 20, filter = null } = {}) {
  if (!meiliEnabled()) return null
  const body = {
    q: String(q || '').trim(),
    limit: Math.min(40, Math.max(5, limit)),
  }
  if (filter) body.filter = filter
  return meiliFetch(`/indexes/${indexUid}/search`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function testMeilisearchConnection() {
  if (!meiliEnabled()) {
    return { ok: false, error: 'Meilisearch not configured' }
  }
  const started = Date.now()
  try {
    await meiliFetch('/health')
    return { ok: true, latencyMs: Date.now() - started }
  } catch (error) {
    return { ok: false, error: error.message, latencyMs: Date.now() - started }
  }
}

export const MEILI_PIPELINE_INDEX = 'connectintel_pipeline'
