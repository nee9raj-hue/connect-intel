import { requireUser } from '../auth.js'
import { readStore } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { generateAiEmail } from '../crm.js'
import { buildCrmDraftOptions, requireAgenda } from '../crmEmailPrompt.js'
import { listPipelineEntries } from '../organizations.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])

  const user = await requireUser(req, res)
  if (!user) return

  const body = getBody(req)
  const { leadId } = body
  if (!leadId) {
    return sendJson(res, 400, { error: 'leadId is required' })
  }

  const options = buildCrmDraftOptions(user, body)
  const agendaError = requireAgenda(options)
  if (agendaError) {
    return sendJson(res, 400, { error: agendaError })
  }

  const store = await readStore()
  const pipelineLead = listPipelineEntries(store, user).find((entry) => entry.id === leadId)
  if (!pipelineLead) {
    return sendJson(res, 404, { error: 'Save this lead to your pipeline first' })
  }

  const draft = await generateAiEmail(pipelineLead, options)
  return sendJson(res, 200, { draft, sender: { name: options.senderName, company: options.senderCompany } })
}
