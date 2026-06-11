import { requireUser } from '../auth.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { findPipelineEntry } from '../pipelineAccess.js'
import { loadPipelineStoreContext } from '../pipelineShard.js'
import { mergeLeadForTenant } from '../crm.js'

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

  const { pipelineStore } = await loadPipelineStoreContext(user)
  const entry = findPipelineEntry(pipelineStore, user, leadId)
  if (!entry) return sendJson(res, 404, { error: 'Lead not found' })

  const lead = mergeLeadForTenant(pipelineStore, user, entry)
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
