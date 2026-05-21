import { requireUser } from '../lib/server/auth.js'
import { createId, readStore, updateStore } from '../lib/server/store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../lib/server/http.js'
import { mergeLeadForClient, normalizeCrm } from '../lib/server/crm.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])

  const user = await requireUser(req, res)
  if (!user) return

  const { leadId, subject, body, aiGenerated = false } = getBody(req)

  if (!leadId || !subject?.trim() || !body?.trim()) {
    return sendJson(res, 400, { error: 'leadId, subject, and body are required' })
  }

  const sentAt = new Date().toISOString()

  const store = await updateStore((draft) => {
    const entry = draft.savedLeads.find((e) => e.userId === user.id && e.lead.id === leadId)
    if (!entry) return draft

    const crm = normalizeCrm(entry.crm)
    crm.emails = [
      {
        id: createId('email'),
        sentAt,
        subject: subject.trim(),
        bodyPreview: body.trim().slice(0, 240),
        aiGenerated: Boolean(aiGenerated),
      },
      ...crm.emails,
    ].slice(0, 50)
    crm.lastEmailSentAt = sentAt
    if (crm.status === 'new') crm.status = 'contacted'
    entry.crm = crm
    return draft
  })

  const entry = store.savedLeads.find((e) => e.userId === user.id && e.lead.id === leadId)
  if (!entry) {
    return sendJson(res, 404, { error: 'Saved lead not found' })
  }

  return sendJson(res, 200, { lead: mergeLeadForClient(entry), sentAt })
}
