import { requireUser } from '../auth.js'
import { markMeetingReminderSent, normalizeExtendedCrm } from '../crmWorkflow.js'
import { mergeLeadForClient } from '../crm.js'
import { findPipelineEntry } from '../pipelineAccess.js'
import { readStore, updateStore } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])

  const user = await requireUser(req, res)
  if (!user) return

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

  return sendJson(res, 200, { lead: mergeLeadForClient(entry) })
}
