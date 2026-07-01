/**
 * Unified workflow trigger catalog — CRM rules + marketing automation graph (Deploy 3).
 */

export const WORKFLOW_ENGINE_VERSION = '2026-06-deploy4'

/** CRM-side trigger names (crmWorkflowRules, pipeline saves). */
export const CRM_WORKFLOW_TRIGGERS = ['lead_created', 'status_change', 'deal_won', 'no_activity_days']

/** Marketing automation graph trigger types (automationTriggers.js). */
export const MARKETING_AUTOMATION_TRIGGERS = [
  'lead_created',
  'contact_added',
  'status_enter',
  'deal_won',
  'form_submitted',
  'email_opened',
  'link_clicked',
  'tag_added',
  'manual',
  'no_activity_days',
]

/** Map CRM events → marketing graph trigger type(s). */
export const CRM_TO_AUTOMATION_TRIGGERS = {
  lead_created: ['lead_created', 'contact_added'],
  status_change: ['status_enter'],
  deal_won: ['deal_won'],
  no_activity_days: ['no_activity_days'],
}

export function resolveAutomationTriggerTypes(crmTrigger) {
  return CRM_TO_AUTOMATION_TRIGGERS[crmTrigger] || []
}

export function buildWorkflowCatalog() {
  return {
    engineVersion: WORKFLOW_ENGINE_VERSION,
    crmTriggers: CRM_WORKFLOW_TRIGGERS,
    marketingTriggers: MARKETING_AUTOMATION_TRIGGERS,
    crmToMarketing: CRM_TO_AUTOMATION_TRIGGERS,
  }
}
