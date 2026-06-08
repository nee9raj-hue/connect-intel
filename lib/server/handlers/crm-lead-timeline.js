import { requireUser } from '../auth.js'
import { readStore } from '../store.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { buildOrgUserResponse } from '../organizations.js'
import { loadPipelineStoreContext } from '../pipelineShard.js'
import { findPipelineEntry } from '../pipelineAccess.js'
import { filterMarketingEvents } from '../marketingEvents.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const sessionUser = await requireUser(req, res)
  if (!sessionUser) return

  const leadId = String(req.query?.leadId || '').trim()
  if (!leadId) return sendJson(res, 400, { error: 'leadId required' })

  const { pipelineStore } = await loadPipelineStoreContext(sessionUser)
  const store = {
    ...(await readStore({ only: ['marketingEvents', 'users', 'organizations', 'organizationMemberships'] })),
    savedLeads: pipelineStore.savedLeads,
  }
  const user = buildOrgUserResponse(store.users.find((u) => u.id === sessionUser.id) || sessionUser, store)
  const entry = findPipelineEntry(store, user, leadId)
  if (!entry) return sendJson(res, 404, { error: 'Lead not found' })

  const marketingEvents = filterMarketingEvents(store, user)
    .filter((e) => e.leadId === leadId)
    .slice(-80)
    .map((e) => ({
      id: e.id,
      type: e.type === 'open' ? 'email_open' : e.type === 'click' ? 'link_click' : e.type,
      campaignId: e.campaignId,
      url: e.url,
      createdAt: e.createdAt,
    }))

  return sendJson(res, 200, { marketingEvents })
}
