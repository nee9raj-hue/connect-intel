import { requireUser } from '../lib/server/auth.js'
import { createId, readStore, updateStore } from '../lib/server/store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../lib/server/http.js'
import { defaultCrm, mergeLeadForClient, normalizeCrm } from '../lib/server/crm.js'

function listSavedLeads(store, userId) {
  return store.savedLeads
    .filter((entry) => entry.userId === userId)
    .sort((left, right) => new Date(right.savedAt).getTime() - new Date(left.savedAt).getTime())
    .map((entry) => mergeLeadForClient(entry))
}

function findEntry(store, userId, leadId) {
  return store.savedLeads.find((entry) => entry.userId === userId && entry.lead.id === leadId)
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
      const existing = findEntry(draft, user.id, lead.id)

      if (!existing) {
        draft.savedLeads.push({
          id: createId('saved'),
          userId: user.id,
          savedAt: new Date().toISOString(),
          crm: defaultCrm(),
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

  if (req.method === 'PATCH') {
    const body = getBody(req)
    const leadId = body.leadId
    const crmPatch = body.crm

    if (!leadId) {
      return sendJson(res, 400, { error: 'leadId is required' })
    }

    const store = await updateStore((draft) => {
      const entry = findEntry(draft, user.id, leadId)
      if (!entry) return draft

      const current = normalizeCrm(entry.crm)
      entry.crm = normalizeCrm({
        ...current,
        ...crmPatch,
        emails: crmPatch?.emails ?? current.emails,
      })

      if (crmPatch?.responseReceived === true && !entry.crm.lastResponseAt) {
        entry.crm.lastResponseAt = new Date().toISOString()
        if (entry.crm.status === 'new' || entry.crm.status === 'contacted' || entry.crm.status === 'follow_up') {
          entry.crm.status = 'replied'
        }
      }

      return draft
    })

    const entry = findEntry(store, user.id, leadId)
    if (!entry) {
      return sendJson(res, 404, { error: 'Saved lead not found' })
    }

    return sendJson(res, 200, { leads: listSavedLeads(store, user.id), lead: mergeLeadForClient(entry) })
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

  return methodNotAllowed(res, ['GET', 'POST', 'PATCH', 'DELETE'])
}
