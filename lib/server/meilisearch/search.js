import { meiliEnabled, meiliSearch, MEILI_CRM_INDEX } from './client.js'
import { searchPlatform } from '../platformSearch.js'
import { readStore } from '../store.js'
import { isPipelineEntryVisibleAsync } from '../pipelineVisibility.js'

const META_STORE_COLLECTIONS = ['users', 'organizations', 'organizationMemberships']

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

function meiliDocToEntryStub(doc) {
  return {
    organizationId: doc.organizationId || null,
    assignedToUserId: doc.assignedToUserId || null,
    savedByUserId: doc.assignedToUserId || null,
    userId: doc.assignedToUserId || null,
    lead: { id: doc.leadId },
  }
}

async function filterMeiliHitsForUser(user, metaStore, hits, limit) {
  const results = []
  const candidates = (hits || []).slice(0, Math.min((hits || []).length, limit * 3))
  const visibility = await Promise.all(
    candidates.map(async (doc) => {
      if (!doc) return false
      if (doc.type === 'lead' || doc.type === 'deal') {
        if (!doc.leadId) return false
        return isPipelineEntryVisibleAsync(user, meiliDocToEntryStub(doc), metaStore)
      }
      if (user.organizationId && doc.organizationId && doc.organizationId !== user.organizationId) {
        return false
      }
      if (!user.organizationId && doc.organizationId) return false
      return true
    })
  )

  for (let i = 0; i < candidates.length; i += 1) {
    if (!visibility[i]) continue
    results.push(hitToResult(candidates[i]))
    if (results.length >= limit) break
  }
  return results
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
    const fetchLimit = Math.min(Math.max(limit * 3, limit), 60)
    const hits = await meiliSearch(MEILI_CRM_INDEX, {
      q: query,
      limit: fetchLimit,
      filter: filterParts.length ? filterParts.join(' AND ') : null,
    })
    const metaStore = await readStore({ only: META_STORE_COLLECTIONS })
    const results = await filterMeiliHitsForUser(user, metaStore, hits?.hits || [], limit)
    if (results.length) {
      return {
        results,
        query,
        provider: 'meilisearch',
        processingTimeMs: hits.processingTimeMs,
      }
    }
  }

  const fallback = searchPlatform(store, user, { q: query, limit })
  return { ...fallback, provider: 'postgres-json' }
}
