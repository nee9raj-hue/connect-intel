import { applyWorkflowRules } from './crmWorkflowRules.js'
import { fireCrmWorkflowAutomations } from './crmAutomationBridge.js'
import { recordAuditEvent } from './auditEvents.js'
import { resolveAutomationTriggerTypes } from './workflowCatalog.js'
import {
  crmRuleToWorkflowDefinition,
  crmVisualWorkflowToDefinition,
} from './workflowRuleBridge.js'
import { buildWorkflowIdempotencyKey, finishWorkflowRun, startWorkflowRun } from './workflowRuns.js'

/** Sync CRM JSON + visual workflow rules (in-store mutation). Returns fired rule metadata. */
export function applyCrmWorkflowRules(store, entry, ctx) {
  return applyWorkflowRules(store, entry, ctx)
}

function definitionForFiredRule(fired) {
  if (fired.workflowType === 'crm_visual' || fired.workflowType === 'crm_visual_workflow') {
    return crmVisualWorkflowToDefinition({
      id: fired.workflowKey,
      name: fired.ruleName,
      trigger: fired.trigger,
    })
  }
  return crmRuleToWorkflowDefinition({
    id: fired.workflowKey,
    name: fired.ruleName,
    trigger: fired.trigger,
  })
}

/** Versioned SQL workflow_runs rows for CRM JSON + visual rules (unification — Phase 2). */
export async function recordFiredCrmWorkflowRuns({
  firedRules,
  trigger,
  leadId,
  organizationId,
  actor,
  meta = {},
}) {
  if (!firedRules?.length || !leadId || !organizationId) return { recorded: 0 }

  let recorded = 0
  for (const fired of firedRules) {
    const triggerType = fired.trigger || trigger
    const idempotencyKey = meta.cron
      ? buildWorkflowIdempotencyKey({
          triggerType,
          workflowKey: fired.workflowKey,
          leadId,
        })
      : null

    const probe = await startWorkflowRun({
      organizationId,
      workflowKey: fired.workflowKey,
      workflowType: fired.workflowType || 'crm_rule',
      triggerType,
      leadId,
      definition: definitionForFiredRule(fired),
      idempotencyKey,
      actorUserId: actor?.id,
      meta: { ...meta, ruleName: fired.ruleName || null },
    })

    if (probe.duplicate) continue
    if (probe.runId) {
      await finishWorkflowRun(probe.runId, { status: 'completed' })
      recorded += 1
    }
  }

  return { recorded }
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
  const firedRules = applyCrmWorkflowRules(store, entry, ctx)
  const leadId = entry?.lead?.id || entry?.id

  if (firedRules?.length) {
    void recordFiredCrmWorkflowRuns({
      firedRules,
      trigger: ctx.trigger,
      leadId,
      organizationId: ctx.organizationId,
      actor: ctx.actor,
      meta: ctx.meta,
    }).catch(() => {})
  }

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
