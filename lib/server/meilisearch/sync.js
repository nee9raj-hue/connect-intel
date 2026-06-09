import { listPipelineSavedEntries } from '../organizations.js'
import { readPipelineShardEntries } from '../pipelineShard.js'
import { MEILI_PIPELINE_INDEX, meiliUpsertDocuments, meiliDeleteDocuments } from './client.js'

function leadToSearchDoc(entry, organizationId) {
  const lead = entry.lead || entry
  const name =
    lead.name ||
    [lead.firstName, lead.lastName].filter(Boolean).join(' ').trim() ||
    lead.email ||
    'Lead'
  return {
    id: lead.id,
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
    assignedToUserId: entry.assignedToUserId || entry.savedByUserId || null,
    updatedAt: entry.updatedAt || entry.savedAt || new Date().toISOString(),
    panel: 'pipeline',
  }
}

export async function syncPipelineLeadsToMeilisearch({ organizationId, shardName, leadIds = null }) {
  if (!shardName) return { indexed: 0 }
  const entries = (await readPipelineShardEntries(shardName, { bypassCache: true })) || []
  const idSet = leadIds?.length ? new Set(leadIds) : null
  const docs = []
  for (const entry of entries) {
    const lead = entry?.lead || entry
    if (!lead?.id) continue
    if (idSet && !idSet.has(lead.id)) continue
    docs.push(leadToSearchDoc(entry, organizationId))
  }
  if (!docs.length) return { indexed: 0 }
  await meiliUpsertDocuments(MEILI_PIPELINE_INDEX, docs)
  return { indexed: docs.length }
}

export async function syncVisiblePipelineToMeilisearch(store, user) {
  const entries = listPipelineSavedEntries(store, user)
  const docs = entries.map((entry) => leadToSearchDoc(entry, user.organizationId))
  if (!docs.length) return { indexed: 0 }
  await meiliUpsertDocuments(MEILI_PIPELINE_INDEX, docs)
  return { indexed: docs.length }
}

export async function deleteOrgFromMeilisearch(organizationId) {
  if (!organizationId) return null
  return meiliDeleteDocuments(MEILI_PIPELINE_INDEX, `organizationId = "${organizationId}"`)
}
