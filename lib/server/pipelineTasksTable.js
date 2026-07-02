import { isPipelineLeadsTableEnabled } from './infra/config.js'
import { isSupabaseEnabled, supabaseRest } from './supabaseClient.js'

const TABLE = 'pipeline_tasks'

export function pipelineTasksTableActive() {
  return isPipelineLeadsTableEnabled() && isSupabaseEnabled()
}

function leadMeta(entry) {
  const lead = entry?.lead || entry
  const leadId = lead?.id || entry?.id
  const leadName =
    [lead?.firstName, lead?.lastName].filter(Boolean).join(' ') || lead?.company || 'Lead'
  return {
    leadId: leadId ? String(leadId) : null,
    leadName,
    company: lead?.company || '',
  }
}

export function buildPipelineTaskRow(organizationId, entry, task) {
  if (!organizationId || !task?.id) return null
  const { leadId, leadName, company } = leadMeta(entry)
  if (!leadId) return null

  const ownerId =
    task.assignedToUserId ||
    entry.assignedToUserId ||
    entry.savedByUserId ||
    entry.userId ||
    null

  return {
    organization_id: String(organizationId),
    lead_id: leadId,
    task_id: String(task.id),
    owner_id: ownerId ? String(ownerId) : null,
    title: String(task.title || 'Task').slice(0, 200),
    due_at: task.dueAt || null,
    status: task.completedAt ? 'done' : 'open',
    payload: { task, leadName, company },
    updated_at: task.completedAt || task.createdAt || new Date().toISOString(),
  }
}

export async function upsertPipelineTasks(rows) {
  if (!pipelineTasksTableActive() || !rows?.length) return { upserted: 0 }

  const chunkSize = 40
  let upserted = 0
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    await supabaseRest(
      `${TABLE}?on_conflict=organization_id,task_id`,
      {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(chunk),
      },
      { timeoutMs: 60_000 }
    )
    upserted += chunk.length
  }
  return { upserted }
}

export async function deletePipelineTasksNotInSet(organizationId, leadId, taskIds) {
  if (!pipelineTasksTableActive() || !organizationId || !leadId) return

  const keep = new Set((taskIds || []).map(String))
  const existing = await supabaseRest(
    `${TABLE}?organization_id=eq.${encodeURIComponent(organizationId)}` +
      `&lead_id=eq.${encodeURIComponent(leadId)}&select=task_id`,
    {},
    { timeoutMs: 20_000 }
  )
  if (!Array.isArray(existing)) return

  for (const row of existing) {
    const taskId = row?.task_id
    if (!taskId || keep.has(String(taskId))) continue
    await supabaseRest(
      `${TABLE}?organization_id=eq.${encodeURIComponent(organizationId)}` +
        `&task_id=eq.${encodeURIComponent(taskId)}`,
      { method: 'DELETE', headers: { Prefer: 'return=minimal' } },
      { timeoutMs: 15_000 }
    )
  }
}

export async function syncPipelineTasksForEntry({ organizationId, entry }) {
  if (!pipelineTasksTableActive() || !organizationId || !entry) return { synced: 0 }

  const tasks = Array.isArray(entry.crm?.tasks) ? entry.crm.tasks : []
  const rows = tasks.map((task) => buildPipelineTaskRow(organizationId, entry, task)).filter(Boolean)

  const { leadId } = leadMeta(entry)
  if (leadId) {
    await deletePipelineTasksNotInSet(
      organizationId,
      leadId,
      tasks.map((t) => t.id)
    )
  }
  const result = await upsertPipelineTasks(rows)
  return { synced: result.upserted || 0 }
}

export async function orgHasPipelineTasks(organizationId) {
  if (!organizationId || !pipelineTasksTableActive()) return false
  try {
    const rows = await supabaseRest(
      `${TABLE}?organization_id=eq.${encodeURIComponent(organizationId)}&select=task_id&limit=1`,
      {},
      { timeoutMs: 10_000, attempts: 1 }
    )
    return Array.isArray(rows) && rows.length > 0
  } catch {
    return false
  }
}

/** Open tasks for My Day — indexed by owner + due date (no full shard). */
export async function listPipelineTasksForMyDay(
  organizationId,
  ownerId,
  { dueBeforeIso, limit = 80 } = {}
) {
  if (!pipelineTasksTableActive() || !organizationId || !ownerId) return []

  const lim = Math.min(200, Math.max(1, Number(limit) || 80))
  let path =
    `${TABLE}?organization_id=eq.${encodeURIComponent(organizationId)}` +
    `&owner_id=eq.${encodeURIComponent(ownerId)}` +
    `&status=neq.done` +
    `&select=lead_id,task_id,title,due_at,payload,updated_at` +
    `&order=due_at.asc.nullslast&limit=${lim}`

  if (dueBeforeIso) {
    path += `&due_at=lte.${encodeURIComponent(dueBeforeIso)}`
  }

  const rows = await supabaseRest(path, {}, { timeoutMs: 20_000 })
  if (!Array.isArray(rows)) return []
  return rows
}
