import { appendActivity, addTask, normalizeExtendedCrm } from './crmWorkflow.js'
import { getOrgCrmSettings } from './crmWorkflowRules.js'

function nodeById(graph, id) {
  return (graph?.nodes || []).find((n) => n.id === id)
}

function nextNodeId(graph, fromId, branch) {
  const edges = (graph?.edges || []).filter((e) => e.from === fromId)
  if (branch) {
    const match = edges.find((e) => e.branch === branch || e.label === branch)
    if (match) return match.to
  }
  return edges[0]?.to || null
}

function runCrmGraphAction(store, entry, node, actor) {
  const config = node.config || {}
  const action = config.action || node.action || 'add_task'
  const userId = actor?.id || 'system'
  const userName = actor?.name || 'Automation'
  let crm = normalizeExtendedCrm(entry.crm)

  if (action === 'add_task' || action === 'create_task') {
    const dueDays = Number(config.dueDays) || 1
    const dueAt = new Date(Date.now() + dueDays * 86400000).toISOString()
    const result = addTask(crm, {
      title: config.title || node.label || 'Follow up',
      dueAt,
      assignedToUserId: entry.assignedToUserId || userId,
      createdByUserId: userId,
      createdByName: userName,
    })
    entry.crm = result.crm
    return
  }

  if (action === 'add_note' || action === 'create_note') {
    entry.crm = appendActivity(crm, {
      type: 'note',
      summary: config.summary || config.title || node.label || 'Automated note',
      userId,
      userName,
      meta: { automated: true, workflow: true },
    })
    return
  }

  if (action === 'set_status' && config.status) {
    entry.crm = appendActivity(
      { ...crm, status: config.status },
      {
        type: 'status',
        summary: `Status set to ${config.status} (workflow)`,
        userId,
        userName,
        meta: { automated: true },
      }
    )
    return
  }

  if (action === 'assign_owner' && config.userId) {
    entry.assignedToUserId = config.userId
    entry.crm = appendActivity(crm, {
      type: 'assignment',
      summary: 'Assigned by workflow',
      userId,
      userName,
      meta: { assignToUserId: config.userId, automated: true },
    })
  }
}

function walkGraph(graph, entry, actor) {
  let nodeId = graph.nodes?.[0]?.id
  let steps = 0
  const maxSteps = 16

  while (nodeId && steps < maxSteps) {
    steps += 1
    const node = nodeById(graph, nodeId)
    if (!node) break

    if (node.type === 'trigger') {
      nodeId = nextNodeId(graph, nodeId)
      continue
    }

    if (node.type === 'condition') {
      const crm = entry.crm || {}
      const pass =
        node.config?.type === 'lead_stage'
          ? (crm.status || 'new') === node.config.value
          : true
      nodeId = nextNodeId(graph, nodeId, pass ? 'yes' : 'no')
      continue
    }

    if (node.type === 'delay') {
      break
    }

    if (node.type === 'action') {
      runCrmGraphAction(null, entry, node, actor)
      nodeId = nextNodeId(graph, nodeId)
      continue
    }

    nodeId = nextNodeId(graph, nodeId)
  }
}

export function applyCrmVisualWorkflows(store, entry, { trigger, previousStatus, newStatus, actor, organizationId, meta = {} }) {
  const settings = getOrgCrmSettings(store, organizationId)
  const workflows = settings.visualWorkflows || []

  for (const wf of workflows) {
    if (wf.enabled === false || !wf.graph?.nodes?.length) continue

    if (wf.trigger === 'status_enter' && trigger === 'status_change') {
      if (wf.status && wf.status !== newStatus) continue
    } else if (wf.trigger === 'lead_created' && trigger !== 'lead_created') {
      continue
    } else if (wf.trigger === 'no_activity_days' && trigger === 'no_activity_days') {
      const threshold = Number(wf.days ?? wf.inactivityDays ?? 7)
      const inactive = Number(meta.inactiveDays ?? 0)
      if (inactive < threshold) continue
    } else {
      continue
    }

    walkGraph(wf.graph, entry, actor)
  }
}
