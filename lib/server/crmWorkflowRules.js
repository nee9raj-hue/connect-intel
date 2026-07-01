import { createId } from './store.js'
import { appendActivity, addTask, normalizeExtendedCrm } from './crmWorkflow.js'
import { pickRoundRobinAssignee } from './crmLeadScore.js'
import { applyCrmVisualWorkflows } from './crmWorkflowGraph.js'
import { getOrganization, listTeamMembers } from './organizations.js'

export const WORKFLOW_TRIGGERS = ['status_enter', 'lead_created', 'no_activity_days']

export function defaultOrgCrmSettings() {
  return {
    workflowRules: [],
    visualWorkflows: [],
    pipelines: [],
    scoringRules: [],
    autoAssignEnabled: false,
    roundRobinCursor: 0,
  }
}

export function getOrgCrmSettings(store, organizationId) {
  const org = organizationId ? getOrganization(store, organizationId) : null
  return { ...defaultOrgCrmSettings(), ...(org?.crmSettings || {}) }
}

export function setOrgCrmSettings(store, organizationId, patch) {
  const org = getOrganization(store, organizationId)
  if (!org) throw new Error('Organization not found')
  org.crmSettings = { ...defaultOrgCrmSettings(), ...(org.crmSettings || {}), ...patch }
  return org.crmSettings
}

function runAction(store, entry, action, actor) {
  const userId = actor?.id || 'system'
  const userName = actor?.name || 'Automation'
  let crm = normalizeExtendedCrm(entry.crm)

  if (action.type === 'add_task') {
    const dueDays = Number(action.dueDays) || 1
    const dueAt = new Date(Date.now() + dueDays * 86400000).toISOString()
    const result = addTask(crm, {
      title: action.title || 'Follow up',
      dueAt,
      assignedToUserId: entry.assignedToUserId || userId,
      createdByUserId: userId,
      createdByName: userName,
    })
    entry.crm = result.crm
    return
  }

  if (action.type === 'add_note') {
    entry.crm = appendActivity(crm, {
      type: 'note',
      summary: action.summary || action.title || 'Automated note',
      userId,
      userName,
      meta: { automated: true, ruleId: action.ruleId },
    })
    return
  }

  if (action.type === 'set_status' && action.status) {
    entry.crm = appendActivity(
      { ...crm, status: action.status },
      {
        type: 'status',
        summary: `Status set to ${action.status} (automation)`,
        userId,
        userName,
        meta: { automated: true },
      }
    )
  }
}

export function applyWorkflowRules(store, entry, { trigger, previousStatus, newStatus, actor, organizationId, meta = {} }) {
  const settings = getOrgCrmSettings(store, organizationId)
  const rules = settings.workflowRules || []

  for (const rule of rules) {
    if (rule.enabled === false) continue
    if (rule.trigger === 'status_enter' && trigger === 'status_change') {
      if (rule.status !== newStatus) continue
    } else if (rule.trigger === 'lead_created' && trigger !== 'lead_created') {
      continue
    } else if (rule.trigger === 'no_activity_days' && trigger === 'no_activity_days') {
      const threshold = Number(rule.days ?? rule.inactivityDays ?? 7)
      const inactive = Number(meta.inactiveDays ?? 0)
      if (inactive < threshold) continue
    } else {
      continue
    }

    for (const action of rule.actions || []) {
      runAction(store, entry, { ...action, ruleId: rule.id }, actor)
    }
  }

  applyCrmVisualWorkflows(store, entry, {
    trigger,
    previousStatus,
    newStatus,
    actor,
    organizationId,
    meta,
  })
}

export function maybeAutoAssignLead(store, entry, organizationId, actor) {
  const settings = getOrgCrmSettings(store, organizationId)
  if (!settings.autoAssignEnabled || entry.assignedToUserId) return entry

  const members = listTeamMembers(store, organizationId)
    .filter((m) => m.pipelineRole !== 'sales' || true)
    .map((m) => m.userId)

  const assignee = pickRoundRobinAssignee(store, organizationId, members)
  if (!assignee) return entry

  entry.assignedToUserId = assignee
  entry.assignedAt = new Date().toISOString()
  entry.assignedByUserId = actor?.id || null
  entry.crm = appendActivity(normalizeExtendedCrm(entry.crm), {
    type: 'assignment',
    summary: 'Auto-assigned to teammate (round robin)',
    userId: actor?.id || 'system',
    userName: actor?.name || 'Automation',
    meta: { assignToUserId: assignee, automated: true },
  })
  return entry
}

export function seedDefaultWorkflowRules(organizationId) {
  return [
    {
      id: createId('wfr'),
      name: 'Replied → send proposal task',
      enabled: true,
      trigger: 'status_enter',
      status: 'replied',
      actions: [{ type: 'add_task', title: 'Send proposal / next steps', dueDays: 2 }],
    },
    {
      id: createId('wfr'),
      name: 'Won → celebration note',
      enabled: true,
      trigger: 'status_enter',
      status: 'won',
      actions: [{ type: 'add_note', summary: 'Deal marked won — update forecast and hand off if needed.' }],
    },
  ]
}
