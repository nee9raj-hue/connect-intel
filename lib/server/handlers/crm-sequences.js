import { requireUser } from '../auth.js'
import { resolveOrgRole } from '../organizations.js'
import {
  createSequence,
  defaultSequenceTemplate,
  enrollLeadInSequence,
  listEnrollmentsForLead,
  listSequencesForOrg,
  processDueSequenceEnrollments,
} from '../crmSequences.js'
import { readStore, updateStore } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'

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
    if (req.query?.process === '1' && organizationId) {
      let result
      await updateStore((draft) => {
        result = processDueSequenceEnrollments(draft, organizationId)
        return draft
      })
      return sendJson(res, 200, result)
    }

    if (req.query?.leadId) {
      return sendJson(res, 200, {
        enrollments: listEnrollmentsForLead(store, req.query.leadId),
      })
    }

    if (!organizationId) {
      return sendJson(res, 200, { sequences: [], template: defaultSequenceTemplate() })
    }

    return sendJson(res, 200, {
      sequences: listSequencesForOrg(store, organizationId),
      template: defaultSequenceTemplate(),
    })
  }

  if (req.method === 'POST') {
    const body = getBody(req) || {}

    if (body.action === 'enroll') {
      if (!organizationId) return sendJson(res, 400, { error: 'Sequences require a company workspace' })
      let payload
      await updateStore((draft) => {
        payload = enrollLeadInSequence(draft, user, {
          sequenceId: body.sequenceId,
          leadId: body.leadId,
        })
        return draft
      })
      return sendJson(res, 200, { ok: true, ...payload })
    }

    if (!organizationId || !user.isOrgAdmin) {
      return sendJson(res, 403, { error: 'Only company admins can create sequences' })
    }

    let seq
    await updateStore((draft) => {
      seq = createSequence(draft, organizationId, user.id, body)
      return draft
    })
    return sendJson(res, 200, { sequence: seq })
  }

  return methodNotAllowed(res, ['GET', 'POST'])
}
