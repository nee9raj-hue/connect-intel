import { fireAutomationTrigger } from './automationTriggers.js'

const CRM_TO_AUTOMATION_TRIGGERS = {
  lead_created: ['lead_created', 'contact_added'],
  status_change: ['status_enter'],
  deal_won: ['deal_won'],
}

export { CRM_TO_AUTOMATION_TRIGGERS }

/**
 * Bridge CRM workflow events into the marketing automation graph runner
 * (workflow unification — Phase 2).
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

  const types = CRM_TO_AUTOMATION_TRIGGERS[trigger] || []
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
