import { requireUser } from '../auth.js'
import { readStore } from '../store.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { findPipelineEntryAsync } from '../pipelineVisibility.js'
import {
  attachPipelineEntriesToStore,
  loadPipelineStoreContext,
  pipelineShardNameForUser,
} from '../pipelineShard.js'
import { mergeLeadForTenant } from '../crm.js'

const META_STORE_COLLECTIONS = ['users', 'organizations', 'organizationMemberships']

/** Minimal lead payload for pipeline hover / quick views. */
export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const user = await requireUser(req, res)
  if (!user) return

  const url = new URL(req.url || '', 'http://local')
  const leadId = String(url.searchParams.get('leadId') || url.pathname.split('/').pop() || '').trim()
  if (!leadId) return sendJson(res, 400, { error: 'leadId is required' })

  const metaStore = await readStore({ only: META_STORE_COLLECTIONS })
  const shardName = pipelineShardNameForUser(user)
  const { pipelineLeadsTableActive, readPipelineLeadById } = await import('../pipelineLeadsTable.js')

  if (pipelineLeadsTableActive()) {
    const tableEntry = await readPipelineLeadById(shardName, leadId)
    if (tableEntry) {
      const storeForMerge = attachPipelineEntriesToStore(metaStore, [tableEntry])
      const entry = await findPipelineEntryAsync(storeForMerge, user, leadId, metaStore)
      if (!entry) return sendJson(res, 404, { error: 'Lead not found' })
      const lead = mergeLeadForTenant(storeForMerge, user, entry)
      return sendQuickSummary(res, lead)
    }
    return sendJson(res, 404, { error: 'Lead not found' })
  }

  const { pipelineStore } = await loadPipelineStoreContext(user)
  const entry = await findPipelineEntryAsync(pipelineStore, user, leadId, metaStore)
  if (!entry) return sendJson(res, 404, { error: 'Lead not found' })

  const lead = mergeLeadForTenant(pipelineStore, user, entry)
  return sendQuickSummary(res, lead)
}

function sendQuickSummary(res, lead) {
  const crm = lead.crm || {}
  return sendJson(res, 200, {
    id: lead.id,
    first_name: lead.firstName || '',
    last_name: lead.lastName || '',
    email: lead.email || '',
    phone: lead.phone || '',
    company: lead.company || '',
    city: lead.city || '',
    state: lead.state || '',
    lead_status: crm.status || 'new',
    lead_score: crm.leadScore ?? null,
    owner_id: lead.assignedToUserId || null,
    last_activity_at:
      crm.lastCommunicationAt || crm.lastEmailSentAt || crm.lastCallAt || null,
    last_activity_type: crm.lastCommunicationType || null,
    tags: crm.tagIds || [],
    created_at: lead.savedAt || lead.createdAt || null,
  })
}
