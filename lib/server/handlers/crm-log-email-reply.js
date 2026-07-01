import { requireUser } from '../auth.js'
import { readStore, updateStore } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { mergeLeadForTenant } from '../tenantIsolation.js'
import { findPipelineEntry } from '../pipelineAccess.js'
import { listPipelineEntries } from '../organizations.js'
import { recordInboundReply } from '../crmEmailThread.js'
import { loadMetaUserAndAssertEditLeads, permissionDeniedResponse } from '../permissionEnforce.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])

  const sessionUser = await requireUser(req, res)
  if (!sessionUser) return

  const { leadId, subject, body, fromEmail } = getBody(req)
  if (!leadId || !body?.trim()) {
    return sendJson(res, 400, { error: 'leadId and reply body are required' })
  }

  const storeBefore = await readStore()
  let user
  try {
    ;({ user } = await loadMetaUserAndAssertEditLeads(sessionUser, storeBefore))
  } catch (permError) {
    const denied = permissionDeniedResponse(permError)
    return sendJson(res, denied.status, denied.body)
  }

  const entryBefore = findPipelineEntry(storeBefore, user, leadId)
  if (!entryBefore) return sendJson(res, 404, { error: 'Lead not in pipeline' })

  const lead = entryBefore.lead || entryBefore
  const subj =
    String(subject || '').trim() ||
    `Re: ${(entryBefore.crm?.emails || [])[0]?.subject || 'your message'}`

  const store = await updateStore((draft) => {
    const entry = findPipelineEntry(draft, user, leadId)
    if (!entry) return draft
    entry.crm = recordInboundReply(entry.crm, {
      subject: subj,
      body: body.trim(),
      fromEmail: fromEmail || lead.email,
      userId: user.id,
      userName: user.name,
    })
    return draft
  })

  const entry = findPipelineEntry(store, user, leadId)
  return sendJson(res, 200, {
    lead: mergeLeadForTenant(store, user, entry),
    leads: listPipelineEntries(store, user, { light: true }),
  })
}
