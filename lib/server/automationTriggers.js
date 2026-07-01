import { readStore } from './store.js'
import { enqueueAutomationRun } from './marketingAutomations.js'
import { executeAutomationGraphStep } from './automationGraphRunner.js'
import { updateStore } from './store.js'
import { marketingAutomationToDefinition } from './workflowRuleBridge.js'
import {
  buildWorkflowIdempotencyKey,
  finishWorkflowRun,
  startWorkflowRun,
} from './workflowRuns.js'

/**
 * Fire automations matching a trigger type for a lead.
 */
export async function fireAutomationTrigger({
  type,
  leadId,
  organizationId,
  createdByUserId,
  meta = {},
}) {
  if (!leadId || !type) return { queued: 0 }

  const store = await readStore({ only: ['marketingAutomations', 'marketingAutomationRuns'] })
  const automations = (store.marketingAutomations || []).filter((a) => {
    if (a.status !== 'active') return false
    if (organizationId && a.organizationId !== organizationId) return false
    if (!organizationId && a.createdByUserId !== createdByUserId) return false
    const triggerType = a.trigger?.type || a.graph?.nodes?.find((n) => n.type === 'trigger')?.config?.type
    return triggerType === type
  })

  let queued = 0
  for (const automation of automations) {
    const config = automation.trigger?.config || {}
    if (type === 'form_submitted' && config.formId && meta.formId !== config.formId) continue
    if (type === 'email_opened' && config.campaignId && meta.campaignId !== config.campaignId) continue
    if (type === 'link_clicked' && config.campaignId && meta.campaignId !== config.campaignId) continue
    if (type === 'status_enter') {
      const targetStatus = config.status || config.stage
      const entered = meta.status || meta.newStatus
      if (targetStatus && entered && targetStatus !== entered) continue
    }
    if (type === 'no_activity_days') {
      const threshold = Number(config.days ?? config.inactivityDays ?? 7)
      const inactive = Number(meta.inactiveDays ?? 0)
      if (!Number.isFinite(inactive) || inactive < threshold) continue
    }

    const idempotencyKey = buildWorkflowIdempotencyKey({
      triggerType: type,
      workflowKey: automation.id,
      leadId,
    })

    const runProbe = await startWorkflowRun({
      organizationId: organizationId || automation.organizationId,
      workflowKey: automation.id,
      workflowType: 'marketing_automation',
      triggerType: type,
      leadId,
      definition: marketingAutomationToDefinition(automation),
      idempotencyKey: meta.cron ? idempotencyKey : null,
      actorUserId: createdByUserId,
      meta,
    })

    if (runProbe.duplicate) continue

    const delayNode = automation.graph?.nodes?.find((n) => n.type === 'delay')
    const delayDays = Number(delayNode?.config?.delayDays ?? automation.delayDays) || 0

    const run = await enqueueAutomationRun(automation, leadId, { delayDays })
    if (delayDays === 0) {
      try {
        await executeAutomationGraphStep(automation, run)
        await updateStore((draft) => {
          const row = (draft.marketingAutomationRuns || []).find((r) => r.id === run.id)
          if (row) {
            row.status = 'completed'
            row.completedAt = new Date().toISOString()
          }
          return draft
        })
        if (runProbe.runId) await finishWorkflowRun(runProbe.runId, { status: 'completed' })
      } catch (err) {
        if (runProbe.runId) {
          await finishWorkflowRun(runProbe.runId, {
            status: 'failed',
            errorMessage: err?.message || 'automation step failed',
          })
        }
        /* cron will retry */
      }
    } else if (runProbe.runId) {
      await finishWorkflowRun(runProbe.runId, { status: 'running' })
    }
    queued += 1
  }

  return { queued }
}
