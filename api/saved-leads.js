import { requireUser } from '../lib/server/auth.js'
import { createId, readStore, updateStore } from '../lib/server/store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../lib/server/http.js'
import { defaultCrm, mergeLeadForClient, normalizeCrm } from '../lib/server/crm.js'
import {
  getMembership,
  listPipelineEntries,
  resolveOrgRole,
} from '../lib/server/organizations.js'

function findEntry(store, user, leadId) {
  const entries = listPipelineEntries(store, user)
  const match = store.savedLeads.find(
    (e) => e.lead.id === leadId && entries.some((p) => p.id === leadId)
  )
  return match
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const user = await requireUser(req, res)
  if (!user) return

  const store = await readStore()
  const { accountType } = resolveOrgRole(user, store)
  const organizationId =
    accountType === 'company' && user.organizationId ? user.organizationId : null

  if (req.method === 'GET') {
    return sendJson(res, 200, { leads: listPipelineEntries(store, user) })
  }

  if (req.method === 'POST') {
    const body = getBody(req)
    const lead = body.lead

    if (!lead?.id) {
      return sendJson(res, 400, { error: 'Lead payload is required' })
    }

    const updated = await updateStore((draft) => {
      const exists = draft.savedLeads.find(
        (e) =>
          e.lead.id === lead.id &&
          (organizationId ? e.organizationId === organizationId : e.userId === user.id)
      )

      if (!exists) {
        draft.savedLeads.push({
          id: createId('saved'),
          userId: user.id,
          organizationId,
          savedByUserId: user.id,
          assignedToUserId: user.isOrgAdmin ? null : user.id,
          savedAt: new Date().toISOString(),
          crm: defaultCrm(),
          lead: {
            ...lead,
            savedAt: new Date().toISOString(),
            inPipeline: true,
          },
        })
      }
      return draft
    })

    return sendJson(res, 200, { leads: listPipelineEntries(updated, user) })
  }

  if (req.method === 'PATCH') {
    const body = getBody(req)
    const leadId = body.leadId
    const crmPatch = body.crm
    const assignToUserId = body.assignToUserId

    if (!leadId) {
      return sendJson(res, 400, { error: 'leadId is required' })
    }

    if (assignToUserId && user.isOrgAdmin && organizationId) {
      const member = getMembership(store, assignToUserId, organizationId)
      if (!member) {
        return sendJson(res, 400, { error: 'Assignee is not in your team' })
      }
    }

    const updated = await updateStore((draft) => {
      const entry = draft.savedLeads.find(
        (e) =>
          e.lead.id === leadId &&
          (organizationId ? e.organizationId === organizationId : e.userId === user.id)
      )
      if (!entry) return draft

      if (assignToUserId !== undefined && user.isOrgAdmin && organizationId) {
        entry.assignedToUserId = assignToUserId || null
        entry.assignedAt = new Date().toISOString()
        entry.assignedByUserId = user.id
      }

      if (crmPatch) {
        const current = normalizeCrm(entry.crm)
        entry.crm = normalizeCrm({
          ...current,
          ...crmPatch,
          emails: crmPatch?.emails ?? current.emails,
        })
        if (crmPatch?.responseReceived === true && !entry.crm.lastResponseAt) {
          entry.crm.lastResponseAt = new Date().toISOString()
          if (['new', 'contacted', 'follow_up'].includes(entry.crm.status)) {
            entry.crm.status = 'replied'
          }
        }
      }

      return draft
    })

    const entry = updated.savedLeads.find((e) => e.lead.id === leadId)
    if (!entry) {
      return sendJson(res, 404, { error: 'Lead not in pipeline' })
    }

    return sendJson(res, 200, {
      leads: listPipelineEntries(updated, user),
      lead: mergeLeadForClient(entry),
    })
  }

  if (req.method === 'DELETE') {
    const body = getBody(req)
    const leadId = body.leadId

    if (!leadId) {
      return sendJson(res, 400, { error: 'leadId is required' })
    }

    const updated = await updateStore((draft) => {
      draft.savedLeads = draft.savedLeads.filter(
        (e) =>
          !(
            e.lead.id === leadId &&
            (organizationId ? e.organizationId === organizationId : e.userId === user.id)
          )
      )
      return draft
    })

    return sendJson(res, 200, { leads: listPipelineEntries(updated, user) })
  }

  return methodNotAllowed(res, ['GET', 'POST', 'PATCH', 'DELETE'])
}
