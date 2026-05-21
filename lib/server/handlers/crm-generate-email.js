import { requireUser } from '../auth.js'
import { readStore } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { generateAiEmail } from '../crm.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])

  const user = await requireUser(req, res)
  if (!user) return

  const { leadId, purpose = 'introduction', tone = 'professional' } = getBody(req)
  if (!leadId) {
    return sendJson(res, 400, { error: 'leadId is required' })
  }

  const store = await readStore()
  const entry = store.savedLeads.find((e) => e.userId === user.id && e.lead.id === leadId)
  if (!entry) {
    return sendJson(res, 404, { error: 'Save this lead to your pipeline first' })
  }

  const draft = await generateAiEmail(entry.lead, { purpose, tone })
  return sendJson(res, 200, { draft })
}
