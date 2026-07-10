import { requireUser, requireOrgAdmin } from '../auth.js'
import { resolveOrgRole } from '../organizations.js'
import {
  getOrgCrmSettings,
  seedDefaultWorkflowRules,
  setOrgCrmSettings,
} from '../crmWorkflowRules.js'
import { normalizePipelinePatch } from '../crmPipelines.js'
import { normalizeScoringRules, getOrgScoringRules, DEFAULT_SCORING_RULES } from '../crmScoringRules.js'
import { readStore, updateStore } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { normalizeUsagePoliciesPatch } from '../resourceProtectionEnforce.js'
import { recordAuditEvent } from '../auditEvents.js'
import { stampCrmWorkflowVersions } from '../workflowPublish.js'

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
    return sendJson(res, 200, {
      settings: {
        ...settings,
        scoringRules: getOrgScoringRules(store, organizationId),
      },
      scoringDefaults: DEFAULT_SCORING_RULES,
      canEdit: Boolean(user.isOrgAdmin),
    })
  }

  if (req.method === 'PATCH') {
    const admin = await requireOrgAdmin(req, res)
    if (!admin) return

    const body = getBody(req) || {}
    let settings
    await updateStore((draft) => {
      const patch = {}
      if (body.autoAssignEnabled !== undefined) patch.autoAssignEnabled = Boolean(body.autoAssignEnabled)
      if (body.workflowRules !== undefined) patch.workflowRules = body.workflowRules
      if (body.visualWorkflows !== undefined) patch.visualWorkflows = body.visualWorkflows
      if (body.pipelines !== undefined) patch.pipelines = normalizePipelinePatch(body.pipelines)
      if (body.scoringRules !== undefined) patch.scoringRules = normalizeScoringRules(body.scoringRules)
      if (body.seedScoringDefaults) patch.scoringRules = normalizeScoringRules(DEFAULT_SCORING_RULES)
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

    const shouldStamp =
      body.workflowRules !== undefined ||
      body.visualWorkflows !== undefined ||
      body.seedDefaults
    if (shouldStamp && settings) {
      await stampCrmWorkflowVersions(organizationId, settings, store)
      await updateStore((draft) => {
        setOrgCrmSettings(draft, organizationId, {
          workflowRules: settings.workflowRules,
          visualWorkflows: settings.visualWorkflows,
        })
        return draft
      })
    }

    void recordAuditEvent({
      organizationId,
      actorUserId: admin.id,
      action: 'crm.settings_updated',
      resourceType: 'organization',
      resourceId: organizationId,
      outcome: 'success',
      metadata: {
        keys: Object.keys(body).filter((k) => k !== 'seedDefaults'),
      },
    }).catch(() => {})
    return sendJson(res, 200, {
      settings: {
        ...settings,
        scoringRules: getOrgScoringRules(
          { organizations: store.organizations },
          organizationId
        ),
      },
    })
  }

  return methodNotAllowed(res, ['GET', 'PATCH'])
}
