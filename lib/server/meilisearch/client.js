import { getMeilisearchConfig, isMeilisearchEnabled } from '../infra/config.js'
import { MEILI_CRM_INDEX } from './indexes.js'
import {
  getMeiliCircuitStatus,
  isMeiliCircuitOpen,
  recordMeiliCircuitFailure,
  recordMeiliCircuitSuccess,
} from './circuit.js'

export { getMeiliCircuitStatus }

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
    const detail =
      data?.message ||
      data?.error ||
      (typeof data === 'string' ? data : data?.status ? JSON.stringify(data) : null) ||
      `Meilisearch ${res.status}`
    throw new Error(detail)
  }
  return data
}

async function waitForMeiliTask(taskUid, { timeoutMs = 90_000 } = {}) {
  if (taskUid == null) return null
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const task = await meiliFetch(`/tasks/${taskUid}`, { timeoutMs: 20_000 })
    if (task?.status === 'succeeded') return task
    if (task?.status === 'failed') {
      const msg = task?.error?.message || task?.error?.code || JSON.stringify(task?.error || task)
      throw new Error(`Meilisearch task ${taskUid} failed: ${msg}`)
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error(`Meilisearch task ${taskUid} timed out after ${timeoutMs}ms`)
}

async function awaitMeiliWriteResponse(response) {
  if (response?.taskUid != null) {
    await waitForMeiliTask(response.taskUid)
    return
  }
  if (Array.isArray(response?.results)) {
    for (const row of response.results) {
      if (row?.taskUid != null) await waitForMeiliTask(row.taskUid)
    }
  }
}

export async function ensureMeilisearchIndex(uid = MEILI_CRM_INDEX, primaryKey = 'id') {
  if (!meiliEnabled()) return false
  const settings = {
    searchableAttributes: [
      'name',
      'email',
      'company',
      'domain',
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
  }
  try {
    const indexInfo = await meiliFetch(`/indexes/${uid}`)
    const stats = await meiliFetch(`/indexes/${uid}/stats`, { timeoutMs: 20_000 }).catch(() => null)
    const docCount = stats?.numberOfDocuments ?? 0
    if (indexInfo?.primaryKey && indexInfo.primaryKey !== primaryKey && docCount === 0) {
      await meiliFetch(`/indexes/${uid}`, { method: 'DELETE' })
      await meiliFetch('/indexes', {
        method: 'POST',
        body: JSON.stringify({ uid, primaryKey }),
      })
    } else if (indexInfo?.primaryKey && indexInfo.primaryKey !== primaryKey) {
      throw new Error(
        `Meilisearch index ${uid} primaryKey is "${indexInfo.primaryKey}" (expected "${primaryKey}")`
      )
    }
    await meiliFetch(`/indexes/${uid}/settings`, {
      method: 'PATCH',
      body: JSON.stringify(settings),
    })
    return true
  } catch (error) {
    if (error?.message?.includes('primaryKey')) throw error
    await meiliFetch('/indexes', {
      method: 'POST',
      body: JSON.stringify({ uid, primaryKey }),
    })
    await meiliFetch(`/indexes/${uid}/settings`, {
      method: 'PATCH',
      body: JSON.stringify(settings),
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
    const response = await meiliFetch(`/indexes/${indexUid}/documents`, {
      method: 'POST',
      body: JSON.stringify(chunk),
      timeoutMs: 60_000,
    })
    await awaitMeiliWriteResponse(response)
    total += chunk.length
  }
  return { indexed: total }
}

export async function meiliDeleteDocuments(indexUid, filter) {
  if (!meiliEnabled()) return null
  const response = await meiliFetch(`/indexes/${indexUid}/documents/delete`, {
    method: 'POST',
    body: JSON.stringify({ filter }),
  })
  await awaitMeiliWriteResponse(response)
  return response
}

export async function meiliSearch(indexUid, { q, limit = 20, filter = null } = {}) {
  if (!meiliEnabled() || isMeiliCircuitOpen()) return null
  const body = {
    q: String(q || '').trim(),
    limit: Math.min(40, Math.max(5, limit)),
  }
  if (filter) body.filter = filter
  try {
    const result = await meiliFetch(`/indexes/${indexUid}/search`, {
      method: 'POST',
      body: JSON.stringify(body),
      timeoutMs: 5_000,
    })
    recordMeiliCircuitSuccess()
    return result
  } catch (error) {
    recordMeiliCircuitFailure(error)
    throw error
  }
}

export async function testMeilisearchConnection() {
  if (!meiliEnabled()) {
    return { ok: false, error: 'Meilisearch not configured' }
  }
  if (isMeiliCircuitOpen()) {
    const circuit = getMeiliCircuitStatus()
    return {
      ok: false,
      error: `Meilisearch circuit open (${circuit.lastError || 'recent failures'})`,
      circuit,
    }
  }
  const started = Date.now()
  try {
    await meiliFetch('/health', { timeoutMs: 10_000 })
    recordMeiliCircuitSuccess()
    return { ok: true, latencyMs: Date.now() - started, index: MEILI_CRM_INDEX }
  } catch (error) {
    recordMeiliCircuitFailure(error)
    return {
      ok: false,
      error: error.message,
      latencyMs: Date.now() - started,
      circuit: getMeiliCircuitStatus(),
    }
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
