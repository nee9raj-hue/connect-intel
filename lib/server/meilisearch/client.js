import { getMeilisearchConfig, isMeilisearchEnabled } from '../infra/config.js'
import { MEILI_CRM_INDEX } from './indexes.js'

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

export async function ensureMeilisearchIndex(uid = MEILI_CRM_INDEX, primaryKey = 'id') {
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
          'body',
          'notes',
          'subtitle',
        ],
        filterableAttributes: [
          'organizationId',
          'type',
          'status',
          'assignedToUserId',
          'ownerUserId',
        ],
        sortableAttributes: ['updatedAt'],
      }),
    })
    return true
  }
}

export async function meiliUpsertDocuments(indexUid, documents) {
  if (!meiliEnabled() || !documents?.length) return null
  await ensureMeilisearchIndex(indexUid)
  const batchSize = 500
  let total = 0
  for (let i = 0; i < documents.length; i += batchSize) {
    const chunk = documents.slice(i, i + batchSize)
    await meiliFetch(`/indexes/${indexUid}/documents`, {
      method: 'POST',
      body: JSON.stringify(chunk),
      timeoutMs: 60_000,
    })
    total += chunk.length
  }
  return { indexed: total }
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
    await ensureMeilisearchIndex(MEILI_CRM_INDEX)
    return { ok: true, latencyMs: Date.now() - started, index: MEILI_CRM_INDEX }
  } catch (error) {
    return { ok: false, error: error.message, latencyMs: Date.now() - started }
  }
}

export async function countMeilisearchDocuments(indexUid, filter) {
  if (!meiliEnabled()) return null
  try {
    const result = await meiliFetch(`/indexes/${indexUid}/search`, {
      method: 'POST',
      body: JSON.stringify({ q: '', filter, limit: 0 }),
      timeoutMs: 20_000,
    })
    return result?.estimatedTotalHits ?? result?.totalHits ?? 0
  } catch {
    return null
  }
}

export async function meilisearchIndexStats(indexUid = MEILI_CRM_INDEX) {
  if (!meiliEnabled()) return null
  try {
    const stats = await meiliFetch(`/indexes/${indexUid}/stats`)
    return {
      numberOfDocuments: stats?.numberOfDocuments ?? stats?.documents ?? 0,
      isIndexing: stats?.isIndexing ?? false,
    }
  } catch {
    return null
  }
}

export { MEILI_CRM_INDEX }
export const MEILI_PIPELINE_INDEX = MEILI_CRM_INDEX
