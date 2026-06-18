import { requireUser } from '../auth.js'
import { readStore } from '../store.js'
import { loadPipelineStoreForLeadIds, META_STORE_COLLECTIONS } from '../pipelineShard.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { generateAiEmail } from '../crm.js'
import { buildCrmDraftOptions, requireAgenda } from '../crmEmailPrompt.js'
import { findPipelineEntryAsync } from '../pipelineVisibility.js'
import { mergeLeadForTenant } from '../tenantIsolation.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])

  const sessionUser = await requireUser(req, res)
  if (!sessionUser) return

  const body = getBody(req)
  const { leadId } = body
  if (!leadId) {
    return sendJson(res, 400, { error: 'leadId is required' })
  }

  const options = buildCrmDraftOptions(sessionUser, body)
  const agendaError = requireAgenda(options)
  if (agendaError) {
    return sendJson(res, 400, { error: agendaError })
  }

  const metaStore = await readStore({ only: META_STORE_COLLECTIONS })
  const user = metaStore.users.find((u) => u.id === sessionUser.id) || sessionUser
  const { pipelineStore, visible } = await loadPipelineStoreForLeadIds(user, [leadId])
  const entry =
    visible[0] ||
    (await findPipelineEntryAsync(
      { ...metaStore, savedLeads: pipelineStore.savedLeads },
      user,
      leadId,
      metaStore
    ))
  if (!entry) {
    return sendJson(res, 404, { error: 'Lead not in pipeline' })
  }

  const pipelineLead = mergeLeadForTenant(
    { ...metaStore, savedLeads: pipelineStore.savedLeads },
    user,
    entry
  )
  const draft = await generateAiEmail(pipelineLead, options)
  return sendJson(res, 200, { draft, sender: { name: options.senderName, company: options.senderCompany } })
}
