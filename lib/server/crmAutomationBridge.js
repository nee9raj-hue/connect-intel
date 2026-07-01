import { fireAutomationTrigger } from './automationTriggers.js'
import { CRM_TO_AUTOMATION_TRIGGERS, resolveAutomationTriggerTypes } from './workflowCatalog.js'

export { CRM_TO_AUTOMATION_TRIGGERS }

/**
 * Bridge CRM workflow events into the marketing automation graph runner
 * (workflow unification — Deploy 3).
 */
export async function fireCrmWorkflowAutomations({
  trigger,
  leadId,
  organizationId,
  createdByUserId,
  actor,
  meta = {},
}) {
  if (!leadId || !trigger) return { queued: 0 }

  const types = resolveAutomationTriggerTypes(trigger)
  let queued = 0
  const actorId = createdByUserId || actor?.id || null

  for (const type of types) {
    const result = await fireAutomationTrigger({
      type,
      leadId,
      organizationId,
      createdByUserId: actorId,
      meta: {
        ...meta,
        status: meta.newStatus ?? meta.status ?? null,
        crmTrigger: trigger,
      },
    })
    queued += result.queued || 0
  }

  return { queued }
}
