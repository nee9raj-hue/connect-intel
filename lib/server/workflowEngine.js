import { applyWorkflowRules } from './crmWorkflowRules.js'
import { fireCrmWorkflowAutomations } from './crmAutomationBridge.js'
import { recordAuditEvent } from './auditEvents.js'
import { resolveAutomationTriggerTypes } from './workflowCatalog.js'

/** Sync CRM JSON + visual workflow rules (in-store mutation). */
export function applyCrmWorkflowRules(store, entry, ctx) {
  applyWorkflowRules(store, entry, ctx)
}

/** Marketing graph fan-out + audit row (async, after pipeline save). */
export async function fireWorkflowAutomationsAndAudit({
  trigger,
  leadId,
  organizationId,
  actor,
  previousStatus,
  newStatus,
  meta = {},
}) {
  if (!leadId || !trigger) return { queued: 0 }

  const automationTypes = resolveAutomationTriggerTypes(trigger)
  const result = await fireCrmWorkflowAutomations({
    trigger,
    leadId,
    organizationId,
    actor,
    meta: { previousStatus, newStatus, ...meta },
  })

  void recordAuditEvent({
    organizationId,
    actorUserId: actor?.id,
    action: 'workflow.dispatch',
    resourceType: 'lead',
    resourceId: leadId,
    outcome: 'success',
    metadata: {
      crmTrigger: trigger,
      automationTypes,
      queued: result.queued || 0,
      previousStatus: previousStatus || null,
      newStatus: newStatus || null,
    },
  }).catch(() => {})

  return result
}

/** Full dispatch: rules (sync) + automations (async). */
export async function dispatchCrmWorkflowEvent(store, entry, ctx) {
  applyCrmWorkflowRules(store, entry, ctx)
  const leadId = entry?.lead?.id || entry?.id
  return fireWorkflowAutomationsAndAudit({
    trigger: ctx.trigger,
    leadId,
    organizationId: ctx.organizationId,
    actor: ctx.actor,
    previousStatus: ctx.previousStatus,
    newStatus: ctx.newStatus,
    meta: ctx.meta,
  })
}
