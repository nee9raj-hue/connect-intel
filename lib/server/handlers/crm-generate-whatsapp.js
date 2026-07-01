import { requireUser } from '../auth.js'
import { readStore } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { buildCrmDraftOptions, requireAgenda } from '../crmEmailPrompt.js'
import { generateWhatsAppMessage } from '../crmWhatsapp.js'
import { listPipelineEntries } from '../organizations.js'
import { loadMetaUserAndAssertEditLeads, permissionDeniedResponse } from '../permissionEnforce.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])

  const sessionUser = await requireUser(req, res)
  if (!sessionUser) return

  const body = getBody(req)
  const { leadId } = body
  if (!leadId) return sendJson(res, 400, { error: 'leadId is required' })

  const options = buildCrmDraftOptions(sessionUser, body)
  const agendaError = requireAgenda(options)
  if (agendaError) return sendJson(res, 400, { error: agendaError })

  const store = await readStore()
  let user
  try {
    ;({ user } = await loadMetaUserAndAssertEditLeads(sessionUser, store))
  } catch (permError) {
    const denied = permissionDeniedResponse(permError)
    return sendJson(res, denied.status, denied.body)
  }

  const pipelineLead = listPipelineEntries(store, user).find((entry) => entry.id === leadId)
  if (!pipelineLead) {
    return sendJson(res, 404, { error: 'Save this lead to your pipeline first' })
  }

  const draft = await generateWhatsAppMessage(pipelineLead, options)
  return sendJson(res, 200, { draft })
}
