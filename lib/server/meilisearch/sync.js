import { readStore } from '../store.js'
import { listPipelineSavedEntries, buildOrgUserResponse } from '../organizations.js'
import { readPipelineShardEntries, pipelineOrgShardName } from '../pipelineShard.js'
import { readPipelineLeadsForUser } from '../pipelineLeadsTable.js'
import { MEILI_CRM_INDEX, meiliUpsertDocuments, meiliDeleteDocuments } from './client.js'
import { pipelineOwnerUserId } from '../../pipelineOwner.js'

const META_STORE_COLLECTIONS = ['users', 'organizations', 'organizationMemberships']

function docId(type, id) {
  const safeType = String(type || 'doc').replace(/[^a-zA-Z0-9_-]/g, '_')
  const safeId = String(id || '').replace(/[^a-zA-Z0-9_-]/g, '_')
  return `${safeType}_${safeId}`
}

export function parseMeiliDocId(value) {
  const raw = String(value || '')
  const idx = raw.indexOf('_')
  if (idx <= 0) return { type: '', id: raw }
  return { type: raw.slice(0, idx), id: raw.slice(idx + 1) }
}

export function contactToSearchDoc(contact, store, organizationId) {
  return {
    ...metaContactDoc(contact, store, organizationId),
    id: docId('contact', contact.id),
  }
}

export function companyToSearchDoc(company, organizationId) {
  const leadCount = company.leadCount ?? company.metadata?.leadCount ?? 0
  return {
    id: docId('company', company.id),
    type: 'company',
    organizationId,
    name: company.name || 'Company',
    domain: company.domain || '',
    city: company.city || '',
    leadCount,
    updatedAt: company.lastActivityAt || company.updatedAt || new Date().toISOString(),
    panel: 'companies',
    subtitle: `${leadCount} contacts`,
  }
}

function metaContactDoc(contact, store, organizationId) {
  const companyName =
    store?.companies?.find((c) => c.id === contact.companyId)?.name || contact.company || ''
  return {
    type: 'contact',
    organizationId: contact.organizationId || organizationId,
    name:
      contact.fullName ||
      [contact.firstName, contact.lastName].filter(Boolean).join(' ') ||
      contact.email ||
      'Contact',
    email: contact.email || '',
    title: contact.title || '',
    phone: contact.phone || '',
    company: companyName,
    updatedAt: contact.updatedAt || contact.createdAt || new Date().toISOString(),
    panel: 'contacts',
    subtitle: [companyName, contact.title].filter(Boolean).join(' · '),
  }
}

export function leadToSearchDoc(entry, organizationId) {
  const lead = entry.lead || entry
  const name =
    lead.name ||
    [lead.firstName, lead.lastName].filter(Boolean).join(' ').trim() ||
    lead.email ||
    'Lead'
  return {
    id: docId('lead', lead.id),
    type: 'lead',
    organizationId: organizationId || entry.organizationId || null,
    leadId: lead.id,
    name,
    email: lead.email || '',
    company: lead.company || '',
    title: lead.title || '',
    phone: lead.phone || '',
    city: lead.city || '',
    state: lead.state || '',
    status: entry.crm?.status || 'new',
    ownerUserId: pipelineOwnerUserId(entry),
    assignedToUserId: entry.assignedToUserId ?? null,
    savedByUserId: entry.savedByUserId || entry.userId || null,
    userId: entry.userId || null,
    updatedAt: entry.updatedAt || entry.savedAt || new Date().toISOString(),
    panel: 'pipeline',
    subtitle: [lead.company, lead.email].filter(Boolean).join(' · '),
  }
}

function dealToSearchDoc(entry, deal, organizationId) {
  const lead = entry.lead || {}
  return {
    id: docId('deal', deal.id),
    type: 'deal',
    organizationId,
    leadId: lead.id,
    name: deal.name || 'Deal',
    company: lead.company || '',
    subtitle: [lead.company, deal.stage].filter(Boolean).join(' · '),
    status: deal.stage || '',
    updatedAt: deal.updatedAt || deal.createdAt || new Date().toISOString(),
    panel: 'pipeline',
  }
}

function metaDocsFromStore(store, organizationId) {
  const docs = []
  const orgFilter = (row) => !organizationId || row.organizationId === organizationId

  for (const contact of (store.contacts || []).filter(orgFilter)) {
    docs.push(contactToSearchDoc(contact, store, organizationId))
  }

  for (const company of (store.companies || []).filter(orgFilter)) {
    docs.push(companyToSearchDoc(company, organizationId))
  }

  for (const campaign of (store.marketingCampaigns || []).filter(orgFilter)) {
    docs.push({
      id: docId('campaign', campaign.id),
      type: 'campaign',
      organizationId: campaign.organizationId || organizationId,
      name: campaign.name || 'Campaign',
      status: campaign.status || 'draft',
      updatedAt: campaign.updatedAt || campaign.createdAt || new Date().toISOString(),
      panel: 'marketing',
      subtitle: `Campaign · ${campaign.status || 'draft'}`,
      campaignId: campaign.id,
    })
  }

  for (const note of (store.teamNotes || []).filter(orgFilter)) {
    docs.push({
      id: docId('note', note.id),
      type: 'note',
      organizationId: note.organizationId || organizationId,
      name: note.title || 'Team note',
      body: note.body || note.content || '',
      updatedAt: note.updatedAt || note.createdAt || new Date().toISOString(),
      panel: 'team',
      subtitle: 'Team note',
    })
  }

  for (const task of (store.teamTasks || []).filter(orgFilter)) {
    docs.push({
      id: docId('task', task.id),
      type: 'task',
      organizationId: task.organizationId || organizationId,
      name: task.title || 'Task',
      body: task.description || '',
      status: task.status || 'open',
      updatedAt: task.updatedAt || task.createdAt || new Date().toISOString(),
      panel: 'team',
      subtitle: task.status || 'task',
    })
  }

  for (const msg of (store.chithiMessages || []).filter(orgFilter)) {
    docs.push({
      id: docId('message', msg.id),
      type: 'message',
      organizationId: msg.organizationId || organizationId,
      name: msg.subject || 'Message',
      body: msg.body || msg.text || '',
      updatedAt: msg.createdAt || new Date().toISOString(),
      panel: 'chithi',
      subtitle: 'Message',
    })
  }

  return docs
}

async function loadOrgCompaniesForSearch(organizationId) {
  const { pipelineCompaniesTableActive, listPipelineCompaniesPage } = await import(
    '../pipelineCompaniesTable.js'
  )
  if (!pipelineCompaniesTableActive()) return []
  const page = await listPipelineCompaniesPage(organizationId, { limit: 500, offset: 0 })
  return page?.companies || []
}

function mergeCompanySearchDocs(storeDocs, sqlCompanies, organizationId) {
  const byId = new Map()
  for (const doc of storeDocs) {
    if (doc.type !== 'company') continue
    const rawId = parseMeiliDocId(doc.id).id || doc.id
    if (rawId) byId.set(String(rawId), doc)
  }
  for (const company of sqlCompanies) {
    byId.set(String(company.id), companyToSearchDoc(company, organizationId))
  }
  const nonCompany = storeDocs.filter((d) => d.type !== 'company')
  return [...nonCompany, ...byId.values()]
}

/** Meta CRM objects + SQL pipeline companies for one org. */
export async function buildOrgMetaSearchDocs(organizationId, store) {
  const base = metaDocsFromStore(store, organizationId)
  const sqlCompanies = await loadOrgCompaniesForSearch(organizationId)
  return mergeCompanySearchDocs(base, sqlCompanies, organizationId)
}

export function countOrgMetaMeilisearchDocs(store, organizationId, { sqlCompanyCount = 0 } = {}) {
  const orgFilter = (row) => !organizationId || row.organizationId === organizationId
  let total = 0
  for (const key of [
    'contacts',
    'marketingCampaigns',
    'teamNotes',
    'teamTasks',
    'chithiMessages',
  ]) {
    total += (store[key] || []).filter(orgFilter).length
  }
  const storeCompanies = (store.companies || []).filter(orgFilter).length
  total += Math.max(storeCompanies, sqlCompanyCount)
  return total
}

export function countExpectedOrgMeilisearchDocs(
  entries,
  store,
  organizationId,
  { sqlCompanyCount = 0 } = {}
) {
  return countExpectedMeilisearchDocs(entries) + countOrgMetaMeilisearchDocs(store, organizationId, { sqlCompanyCount })
}

export async function syncMetaDocsToMeilisearch({ organizationId, store = null, docs = null }) {
  if (!organizationId) return { indexed: 0 }
  const { meiliEnabled, ensureMeilisearchIndex } = await import('./client.js')
  if (!meiliEnabled()) return { indexed: 0, skipped: true }

  let list = docs
  if (!list) {
    const meta =
      store ||
      (await readStore({
        only: [
          'contacts',
          'companies',
          'marketingCampaigns',
          'teamNotes',
          'teamTasks',
          'chithiMessages',
        ],
      }))
    list = await buildOrgMetaSearchDocs(organizationId, meta)
  }
  if (!list.length) return { indexed: 0 }

  await ensureMeilisearchIndex(MEILI_CRM_INDEX)
  await meiliUpsertDocuments(MEILI_CRM_INDEX, list)
  return { indexed: list.length }
}

export async function loadOrgPipelineEntries(organizationId, store) {
  if (!organizationId) return []
  const owner =
    (store.users || []).find(
      (u) => u.organizationId === organizationId && (u.isOrgAdmin || u.orgRole === 'org_admin')
    ) || (store.users || []).find((u) => u.organizationId === organizationId)
  if (!owner) return []

  const user = buildOrgUserResponse(
    { ...owner, organizationId, accountType: 'company' },
    store
  )
  const shardName = pipelineOrgShardName(organizationId)
  const { pipelineLeadsTableActive } = await import('../pipelineLeadsTable.js')
  if (pipelineLeadsTableActive()) {
    const fromTable = await readPipelineLeadsForUser(user, store, shardName, {})
    if (fromTable?.length) return fromTable
  }
  return (await readPipelineShardEntries(shardName, { bypassCache: true })) || []
}

function entriesToSearchDocs(entries, organizationId, leadIds = null) {
  const idSet = leadIds?.length ? new Set(leadIds.map(String)) : null
  const docs = []
  for (const entry of entries) {
    const lead = entry?.lead || entry
    if (!lead?.id) continue
    if (idSet && !idSet.has(String(lead.id))) continue
    docs.push(leadToSearchDoc(entry, organizationId))
    for (const deal of entry.crm?.deals || []) {
      if (!deal?.id) continue
      docs.push(dealToSearchDoc(entry, deal, organizationId))
    }
  }
  return docs
}

export function countExpectedMeilisearchDocs(entries) {
  let total = 0
  for (const entry of entries || []) {
    const lead = entry?.lead || entry
    if (!lead?.id) continue
    total += 1
    total += (entry.crm?.deals || []).filter((d) => d?.id).length
  }
  return total
}

export async function syncLeadEntriesToMeilisearch({ organizationId, entries }) {
  if (!organizationId || !entries?.length) return { indexed: 0 }
  const { meiliEnabled, ensureMeilisearchIndex } = await import('./client.js')
  if (!meiliEnabled()) return { indexed: 0, skipped: true }
  const docs = entriesToSearchDocs(entries, organizationId)
  if (!docs.length) return { indexed: 0 }
  await ensureMeilisearchIndex(MEILI_CRM_INDEX)
  await meiliUpsertDocuments(MEILI_CRM_INDEX, docs)
  return { indexed: docs.length }
}

export async function syncPipelineLeadsToMeilisearch({ organizationId, shardName, leadIds = null }) {
  let entries = []
  if (organizationId) {
    const store = await readStore({ only: META_STORE_COLLECTIONS })
    entries = await loadOrgPipelineEntries(organizationId, store)
  } else if (shardName) {
    entries = (await readPipelineShardEntries(shardName, { bypassCache: true })) || []
  }
  const docs = entriesToSearchDocs(entries, organizationId, leadIds)
  if (!docs.length) return { indexed: 0 }
  const { meiliEnabled } = await import('./client.js')
  if (!meiliEnabled()) return { indexed: 0, skipped: true }
  await meiliUpsertDocuments(MEILI_CRM_INDEX, docs)
  return { indexed: docs.length }
}

export async function syncOrgCrmToMeilisearch(organizationId) {
  if (!organizationId) return { indexed: 0 }

  const shardName = pipelineOrgShardName(organizationId)
  const meta = await readStore({
    only: [
      'contacts',
      'companies',
      'marketingCampaigns',
      'teamNotes',
      'teamTasks',
      'chithiMessages',
    ],
  })

  const pipeline = await syncPipelineLeadsToMeilisearch({ organizationId, shardName })
  const metaDocs = await buildOrgMetaSearchDocs(organizationId, meta)
  if (metaDocs.length) {
    await meiliUpsertDocuments(MEILI_CRM_INDEX, metaDocs)
  }

  return { indexed: (pipeline.indexed || 0) + metaDocs.length, organizationId, metaDocs: metaDocs.length }
}

export async function syncAllOrganizationsToMeilisearch() {
  const store = await readStore({ only: ['organizations'] })
  const orgs = store.organizations || []
  let total = 0
  const results = []
  for (const org of orgs) {
    if (!org?.id) continue
    const row = await syncOrgCrmToMeilisearch(org.id)
    total += row.indexed || 0
    results.push({ organizationId: org.id, name: org.name, indexed: row.indexed })
  }
  return { total, organizations: results }
}

export async function syncVisiblePipelineToMeilisearch(store, user) {
  const entries = listPipelineSavedEntries(store, user)
  const docs = entries.map((entry) => leadToSearchDoc(entry, user.organizationId))
  if (!docs.length) return { indexed: 0 }
  await meiliUpsertDocuments(MEILI_CRM_INDEX, docs)
  return { indexed: docs.length }
}

export async function deleteOrgFromMeilisearch(organizationId) {
  if (!organizationId) return null
  return meiliDeleteDocuments(MEILI_CRM_INDEX, `organizationId = "${organizationId}"`)
}
