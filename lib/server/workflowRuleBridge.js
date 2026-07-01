/**
 * Bridge CRM JSON workflow rules into automation-graph-shaped definitions (Deploy 4).
 */

export function crmRuleToWorkflowDefinition(rule) {
  if (!rule) return {}
  return {
    source: 'crm_workflow_rules',
    id: rule.id,
    name: rule.name,
    trigger: rule.trigger,
    status: rule.status || null,
    days: rule.days ?? rule.inactivityDays ?? null,
    actions: rule.actions || [],
    enabled: rule.enabled !== false,
  }
}

export function crmVisualWorkflowToDefinition(workflow) {
  if (!workflow) return {}
  return {
    source: 'crm_visual_workflows',
    id: workflow.id,
    name: workflow.name,
    trigger: workflow.trigger,
    status: workflow.status || null,
    days: workflow.days ?? workflow.inactivityDays ?? null,
    graph: workflow.graph || { nodes: [], edges: [] },
    enabled: workflow.enabled !== false,
  }
}

export function marketingAutomationToDefinition(automation) {
  if (!automation) return {}
  return {
    source: 'marketing_automations',
    id: automation.id,
    name: automation.name,
    trigger: automation.trigger,
    graph: automation.graph || { nodes: [], edges: [] },
    status: automation.status,
  }
}
