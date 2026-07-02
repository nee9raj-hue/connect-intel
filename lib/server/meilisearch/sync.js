import { readStore } from '../store.js'
import { listPipelineSavedEntries, buildOrgUserResponse } from '../organizations.js'
import { readPipelineShardEntries, pipelineOrgShardName } from '../pipelineShard.js'
import { readPipelineLeadsForUser } from '../pipelineLeadsTable.js'
import { MEILI_CRM_INDEX, meiliUpsertDocuments, meiliDeleteDocuments } from './client.js'
import { pipelineOwnerUserId } from '../../pipelineOwner.js'

const META_STORE_COLLECTIONS = ['users', 'organizations', 'organizationMemberships']

function docId(type, id) {
  return `${type}:${id}`
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
    docs.push({
      id: docId('contact', contact.id),
      type: 'contact',
      organizationId: contact.organizationId || organizationId,
      name: contact.fullName || [contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.email || 'Contact',
      email: contact.email || '',
      title: contact.title || '',
      phone: contact.phone || '',
      company: store.companies?.find((c) => c.id === contact.companyId)?.name || '',
      updatedAt: contact.updatedAt || contact.createdAt || new Date().toISOString(),
      panel: 'contacts',
      subtitle: contact.title || '',
    })
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
  const metaDocs = metaDocsFromStore(meta, organizationId)
  if (metaDocs.length) {
    await meiliUpsertDocuments(MEILI_CRM_INDEX, metaDocs)
  }

  return { indexed: (pipeline.indexed || 0) + metaDocs.length, organizationId }
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
