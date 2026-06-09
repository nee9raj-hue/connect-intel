import { meiliEnabled, meiliSearch, MEILI_CRM_INDEX } from './client.js'
import { searchPlatform } from '../platformSearch.js'

const TYPE_PANEL = {
  lead: 'pipeline',
  contact: 'contacts',
  company: 'companies',
  deal: 'pipeline',
  campaign: 'marketing',
  task: 'team',
  note: 'team',
  message: 'chithi',
}

function hitToResult(doc) {
  const type = doc.type || 'lead'
  return {
    type,
    id: doc.leadId || doc.campaignId || doc.id?.split(':')?.[1] || doc.id,
    title: doc.name || doc.email || type,
    subtitle: doc.subtitle || [doc.company, doc.email].filter(Boolean).join(' · '),
    panel: doc.panel || TYPE_PANEL[type] || 'pipeline',
    leadId: doc.leadId,
    campaignId: doc.campaignId,
    view: type === 'deal' ? 'deals' : undefined,
    dealStage: type === 'deal' ? doc.status : undefined,
    tab: type === 'campaign' ? 'reports' : undefined,
  }
}

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
    const hits = await meiliSearch(MEILI_CRM_INDEX, {
      q: query,
      limit,
      filter: filterParts.length ? filterParts.join(' AND ') : null,
    })
    const results = (hits?.hits || []).map(hitToResult)
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
