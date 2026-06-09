import { meiliEnabled, meiliSearch, MEILI_PIPELINE_INDEX } from './client.js'
import { searchPlatform } from '../platformSearch.js'

/**
 * Platform search — Meilisearch when configured, otherwise in-memory scan.
 */
export async function searchPlatformFast(store, user, { q = '', limit = 20 } = {}) {
  const query = String(q || '').trim()
  if (query.length < 2) return { results: [], query, provider: 'none' }

  if (meiliEnabled()) {
    const filterParts = []
    if (user.organizationId) {
      filterParts.push(`organizationId = "${user.organizationId}"`)
    }
    const hits = await meiliSearch(MEILI_PIPELINE_INDEX, {
      q: query,
      limit,
      filter: filterParts.length ? filterParts.join(' AND ') : null,
    })
    const results = (hits?.hits || []).map((doc) => ({
      type: doc.type || 'lead',
      id: doc.leadId || doc.id,
      title: doc.name || doc.email || 'Lead',
      subtitle: [doc.company, doc.email].filter(Boolean).join(' · '),
      panel: doc.panel || 'pipeline',
      leadId: doc.leadId || doc.id,
    }))
    const seen = new Set(results.map((r) => `${r.type}:${r.id}`))
    const partial = searchPlatform({ ...store, savedLeads: [] }, user, { q: query, limit })
    for (const row of partial.results || []) {
      if (row.type === 'lead') continue
      const key = `${row.type}:${row.id}`
      if (seen.has(key)) continue
      seen.add(key)
      results.push(row)
      if (results.length >= limit) break
    }

    if (results.length) {
      return {
        results: results.slice(0, limit),
        query,
        provider: 'meilisearch',
        processingTimeMs: hits.processingTimeMs,
      }
    }
  }

  const fallback = searchPlatform(store, user, { q: query, limit })
  return { ...fallback, provider: 'postgres-json' }
}
