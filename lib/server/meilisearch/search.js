import { meiliEnabled, meiliSearch, MEILI_CRM_INDEX } from './client.js'
import { searchPlatform } from '../platformSearch.js'
import { readStore } from '../store.js'
import { isPipelineEntryVisibleAsync } from '../pipelineVisibility.js'
import { meiliDocToEntryStub } from './pipelineSearchStub.js'
import { parseMeiliDocId } from './sync.js'
import { userCanViewNote, userCanViewTask } from '../teamCollaboration.js'

const META_STORE_COLLECTIONS = ['users', 'organizations', 'organizationMemberships']

async function hydrateStoreLeadsFromTable(user, store, q, limit) {
  const query = String(q || '').trim()
  if (query.length < 2) return store

  const { pipelineLeadsTableActive } = await import('../pipelineLeadsTable.js')
  if (!pipelineLeadsTableActive()) return store

  const { searchPipelineLeadIdsViaTable } = await import('../pipelineTableSearch.js')
  const { loadPipelineStoreForLeadIds } = await import('../pipelineShard.js')
  const metaStore =
    store?.users?.length && store?.organizations
      ? {
          users: store.users,
          organizations: store.organizations,
          organizationMemberships: store.organizationMemberships,
        }
      : await readStore({ only: META_STORE_COLLECTIONS })

  const ids = await searchPipelineLeadIdsViaTable(user, metaStore, { q: query }, {
    limit: Math.min(Math.max(limit * 3, limit), 60),
  })
  if (!ids?.length) return store

  const { visible } = await loadPipelineStoreForLeadIds(user, ids)
  return { ...store, savedLeads: visible || [] }
}

const TYPE_PANEL = {
  lead: 'pipeline',
  contact: 'contacts',
  company: 'companies',
  deal: 'pipeline',
  campaign: 'marketing',
  task: 'chithi',
  note: 'chithi',
  message: 'chithi',
  template: 'marketing',
}

function meiliRecordId(doc) {
  return doc.leadId || doc.campaignId || parseMeiliDocId(doc.id).id || doc.id
}

function hitNavigation(type) {
  if (type === 'task') return { panel: 'chithi', tab: 'tasks' }
  if (type === 'note' || type === 'message') return { panel: 'chithi' }
  if (type === 'template') return { panel: 'marketing', tab: 'templates' }
  return {}
}

function hitToResult(doc) {
  const type = doc.type || 'lead'
  const nav = hitNavigation(type)
  return {
    type,
    id: meiliRecordId(doc),
    title: doc.name || doc.email || type,
    subtitle: doc.subtitle || [doc.company, doc.email].filter(Boolean).join(' · '),
    panel: nav.panel || doc.panel || TYPE_PANEL[type] || 'pipeline',
    leadId: doc.leadId,
    campaignId: doc.campaignId,
    view: type === 'deal' ? 'deals' : undefined,
    dealStage: type === 'deal' ? doc.status : undefined,
    tab: nav.tab ?? (type === 'campaign' ? 'reports' : undefined),
  }
}

function findCollaborationRow(store, type, doc) {
  const id = meiliRecordId(doc)
  if (type === 'task') return (store.teamTasks || []).find((row) => row.id === id)
  if (type === 'note') return (store.teamNotes || []).find((row) => row.id === id)
  return null
}

async function filterMeiliHitsForUser(user, metaStore, hits, limit, collaborationStore = {}) {
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
      if (doc.type === 'task') {
        const task = findCollaborationRow(collaborationStore, 'task', doc)
        return task ? userCanViewTask(task, user) : false
      }
      if (doc.type === 'note') {
        const note = findCollaborationRow(collaborationStore, 'note', doc)
        return note ? userCanViewNote(note, user) : false
      }
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
    const fetchLimit = Math.min(Math.max(limit * 4, limit), 80)
    const hits = await meiliSearch(MEILI_CRM_INDEX, {
      q: query,
      limit: fetchLimit,
      filter: filterParts.length ? filterParts.join(' AND ') : null,
    })
    const metaStore = await readStore({ only: META_STORE_COLLECTIONS })
    const results = await filterMeiliHitsForUser(
      user,
      metaStore,
      hits?.hits || [],
      limit,
      store
    )
    if (results.length) {
      return {
        results,
        query,
        provider: 'meilisearch',
        processingTimeMs: hits.processingTimeMs,
      }
    }
  }

  const hydrated = await hydrateStoreLeadsFromTable(user, store, query, limit)
  const fallback = searchPlatform(hydrated, user, { q: query, limit })
  const provider =
    (hydrated.savedLeads?.length || 0) > (store.savedLeads?.length || 0)
      ? 'pipeline_leads_search'
      : 'postgres-json'
  return { ...fallback, provider }
}
