import { requireUser } from '../auth.js'
import { resolveOrgRole } from '../organizations.js'
import {
  getOrgCrmSettings,
  seedDefaultWorkflowRules,
  setOrgCrmSettings,
} from '../crmWorkflowRules.js'
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

  if (!organizationId) {
    return sendJson(res, 400, { error: 'Automation settings require a company workspace' })
  }

  if (!user.isOrgAdmin) {
    return sendJson(res, 403, { error: 'Only company admins can manage automation' })
  }

  if (req.method === 'GET') {
    const settings = getOrgCrmSettings(store, organizationId)
    return sendJson(res, 200, { settings })
  }

  if (req.method === 'PATCH') {
    const body = getBody(req) || {}
    let settings
    await updateStore((draft) => {
      const patch = {}
      if (body.autoAssignEnabled !== undefined) patch.autoAssignEnabled = Boolean(body.autoAssignEnabled)
      if (body.workflowRules !== undefined) patch.workflowRules = body.workflowRules
      if (body.seedDefaults) {
        patch.workflowRules = seedDefaultWorkflowRules(organizationId)
      }
      settings = setOrgCrmSettings(draft, organizationId, patch)
      return draft
    })
    return sendJson(res, 200, { settings })
  }

  return methodNotAllowed(res, ['GET', 'PATCH'])
}
