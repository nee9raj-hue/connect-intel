import { requireUser } from '../auth.js'
import { markMeetingReminderSent, normalizeExtendedCrm } from '../crmWorkflow.js'
import { mergeLeadForTenant } from '../tenantIsolation.js'
import { findPipelineEntry } from '../pipelineAccess.js'
import { readStore, updateStore } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { loadMetaUserAndAssertEditLeads, permissionDeniedResponse } from '../permissionEnforce.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])

  const user = await requireUser(req, res)
  if (!user) return

  const store = await readStore()
  try {
    await loadMetaUserAndAssertEditLeads(user, store)
  } catch (permError) {
    const denied = permissionDeniedResponse(permError)
    return sendJson(res, denied.status, denied.body)
  }

  const body = getBody(req)
  const { leadId, meetingId } = body
  if (!leadId || !meetingId) {
    return sendJson(res, 400, { error: 'leadId and meetingId required' })
  }

  const updated = await updateStore((draft) => {
    const entry = findPipelineEntry(draft, user, leadId)
    if (!entry) return draft
    entry.crm = markMeetingReminderSent(entry.crm, meetingId)
    return draft
  })

  const entry = findPipelineEntry(updated, user, leadId)
  if (!entry) return sendJson(res, 404, { error: 'Lead not found' })

  return sendJson(res, 200, { lead: mergeLeadForTenant(updated, user, entry) })
}
