import { requireUser } from '../auth.js'
import { resolveOrgRole } from '../organizations.js'
import {
  getOrgCrmSettings,
  seedDefaultWorkflowRules,
  setOrgCrmSettings,
} from '../crmWorkflowRules.js'
import { normalizePipelinePatch } from '../crmPipelines.js'
import { normalizeScoringRules } from '../crmScoringRules.js'
import { readStore, updateStore } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { normalizeUsagePoliciesPatch } from '../resourceProtectionEnforce.js'

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
    return sendJson(res, 400, { error: 'CRM workspace settings require a company account' })
  }

  if (req.method === 'GET') {
    const settings = getOrgCrmSettings(store, organizationId)
    return sendJson(res, 200, { settings, canEdit: Boolean(user.isOrgAdmin) })
  }

  if (req.method === 'PATCH') {
    if (!user.isOrgAdmin) {
      return sendJson(res, 403, { error: 'Only company admins can manage CRM settings' })
    }

    const body = getBody(req) || {}
    let settings
    await updateStore((draft) => {
      const patch = {}
      if (body.autoAssignEnabled !== undefined) patch.autoAssignEnabled = Boolean(body.autoAssignEnabled)
      if (body.workflowRules !== undefined) patch.workflowRules = body.workflowRules
      if (body.visualWorkflows !== undefined) patch.visualWorkflows = body.visualWorkflows
      if (body.pipelines !== undefined) patch.pipelines = normalizePipelinePatch(body.pipelines)
      if (body.scoringRules !== undefined) patch.scoringRules = normalizeScoringRules(body.scoringRules)
      if (body.seedDefaults) {
        patch.workflowRules = seedDefaultWorkflowRules(organizationId)
      }
      if (body.usagePolicies !== undefined) {
        const normalized = normalizeUsagePoliciesPatch(body.usagePolicies)
        if (normalized) {
          const current = getOrgCrmSettings(draft, organizationId)
          patch.usagePolicies = { ...(current.usagePolicies || {}), ...normalized }
          if (normalized.roleLimits) {
            patch.usagePolicies.roleLimits = {
              ...(current.usagePolicies?.roleLimits || {}),
              ...normalized.roleLimits,
            }
          }
        }
      }
      settings = setOrgCrmSettings(draft, organizationId, patch)
      return draft
    })
    return sendJson(res, 200, { settings })
  }

  return methodNotAllowed(res, ['GET', 'PATCH'])
}
