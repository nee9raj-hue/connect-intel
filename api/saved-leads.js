import { requireUser } from '../lib/server/auth.js'
import { createId, readStore, updateStore } from '../lib/server/store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../lib/server/http.js'

function listSavedLeads(store, userId) {
  return store.savedLeads
    .filter((entry) => entry.userId === userId)
    .sort((left, right) => new Date(right.savedAt).getTime() - new Date(left.savedAt).getTime())
    .map((entry) => entry.lead)
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const user = await requireUser(req, res)
  if (!user) return

  if (req.method === 'GET') {
    const store = await readStore()
    return sendJson(res, 200, { leads: listSavedLeads(store, user.id) })
  }

  if (req.method === 'POST') {
    const body = getBody(req)
    const lead = body.lead

    if (!lead?.id) {
      return sendJson(res, 400, { error: 'Lead payload is required' })
    }

    const store = await updateStore((draft) => {
      const existing = draft.savedLeads.find(
        (entry) => entry.userId === user.id && entry.lead.id === lead.id
      )

      if (!existing) {
        draft.savedLeads.push({
          id: createId('saved'),
          userId: user.id,
          savedAt: new Date().toISOString(),
          lead: {
            ...lead,
            savedAt: new Date().toISOString(),
          },
        })
      }
      return draft
    })

    return sendJson(res, 200, { leads: listSavedLeads(store, user.id) })
  }

  if (req.method === 'DELETE') {
    const body = getBody(req)
    const leadId = body.leadId

    if (!leadId) {
      return sendJson(res, 400, { error: 'leadId is required' })
    }

    const store = await updateStore((draft) => {
      draft.savedLeads = draft.savedLeads.filter(
        (entry) => !(entry.userId === user.id && entry.lead.id === leadId)
      )
      return draft
    })

    return sendJson(res, 200, { leads: listSavedLeads(store, user.id) })
  }

  return methodNotAllowed(res, ['GET', 'POST', 'DELETE'])
}

