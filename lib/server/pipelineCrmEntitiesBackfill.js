import { pipelineOrgShardName, readPipelineShardEntries } from './pipelineShard.js'
import { isSupabaseEnabled, supabaseRest } from './supabaseClient.js'
import { readStore } from './store.js'
import { normalizeExtendedCrm } from './crmWorkflow.js'
import {
  buildPipelineTaskRow,
  deletePipelineTasksNotInSet,
  pipelineTasksTableActive,
  upsertPipelineTasks,
} from './pipelineTasksTable.js'
import {
  buildPipelineMeetingRow,
  deletePipelineMeetingsNotInSet,
  pipelineMeetingsTableActive,
  upsertPipelineMeetings,
} from './pipelineMeetingsTable.js'

const LEADS_TABLE = 'pipeline_leads'
const TASKS_TABLE = 'pipeline_tasks'
const MEETINGS_TABLE = 'pipeline_meetings'

function resolveEntryCrm(entry) {
  if (entry?.crm && typeof entry.crm === 'object') return entry.crm
  if (entry?.entry?.crm && typeof entry.entry.crm === 'object') return entry.entry.crm
  return {}
}

function entryFromRow(row) {
  if (row?.entry && typeof row.entry === 'object') return row.entry
  return row
}

function countCrmEntities(entries) {
  let taskCount = 0
  let meetingCount = 0
  for (const entry of entries || []) {
    const crm = normalizeExtendedCrm(resolveEntryCrm(entry))
    taskCount += (crm.tasks || []).length
    meetingCount += (crm.meetings || []).length
  }
  return { taskCount, meetingCount }
}

async function backfillEntitiesFromPipelineLeads(shardName, organizationId, options = {}) {
  const { dryRun = false, batchSize = 50 } = options
  let offset = 0
  let scanned = 0
  let tasksUpserted = 0
  let meetingsUpserted = 0
  const pageSize = 80
  const taskBatch = []
  const meetingBatch = []

  while (true) {
    const rows = await supabaseRest(
      `${LEADS_TABLE}?shard_name=eq.${encodeURIComponent(shardName)}` +
        `&select=lead_id,entry&order=updated_at.desc&offset=${offset}&limit=${pageSize}`,
      {},
      { timeoutMs: 60_000 }
    )
    if (!Array.isArray(rows) || !rows.length) break

    for (const row of rows) {
      scanned += 1
      const entry = entryFromRow(row.entry)
      const crm = normalizeExtendedCrm(resolveEntryCrm(entry))
      const tasks = crm.tasks || []
      const meetings = crm.meetings || []

      for (const task of tasks) {
        const built = buildPipelineTaskRow(organizationId, entry, task)
        if (built) taskBatch.push(built)
      }
      for (const meeting of meetings) {
        const built = buildPipelineMeetingRow(organizationId, entry, meeting)
        if (built) meetingBatch.push(built)
      }

      if (!dryRun && entry) {
        const leadId = entry.lead?.id || row.lead_id
        if (leadId) {
          await deletePipelineTasksNotInSet(
            organizationId,
            leadId,
            tasks.map((t) => t.id)
          )
          await deletePipelineMeetingsNotInSet(
            organizationId,
            leadId,
            meetings.map((m) => m.id)
          )
        }
      }
    }

    if (!dryRun) {
      for (let i = 0; i < taskBatch.length; i += batchSize) {
        const part = await upsertPipelineTasks(taskBatch.slice(i, i + batchSize))
        tasksUpserted += part.upserted || 0
      }
      for (let i = 0; i < meetingBatch.length; i += batchSize) {
        const part = await upsertPipelineMeetings(meetingBatch.slice(i, i + batchSize))
        meetingsUpserted += part.upserted || 0
      }
      taskBatch.length = 0
      meetingBatch.length = 0
    } else {
      tasksUpserted += taskBatch.length
      meetingsUpserted += meetingBatch.length
      taskBatch.length = 0
      meetingBatch.length = 0
    }

    if (rows.length < pageSize) break
    offset += pageSize
  }

  return { scanned, tasksUpserted, meetingsUpserted, source: 'pipeline_leads' }
}

async function backfillEntitiesFromShard(shardName, organizationId, options = {}) {
  const { dryRun = false, batchSize = 50, bypassCache = true } = options
  const entries = (await readPipelineShardEntries(shardName, { bypassCache })) || []
  const taskBatch = []
  const meetingBatch = []

  for (const entry of entries) {
    const crm = normalizeExtendedCrm(entry.crm)
    const tasks = crm.tasks || []
    const meetings = crm.meetings || []

    for (const task of tasks) {
      const built = buildPipelineTaskRow(organizationId, entry, task)
      if (built) taskBatch.push(built)
    }
    for (const meeting of meetings) {
      const built = buildPipelineMeetingRow(organizationId, entry, meeting)
      if (built) meetingBatch.push(built)
    }

    if (!dryRun) {
      const leadId = entry.lead?.id || entry.id
      if (leadId) {
        await deletePipelineTasksNotInSet(
          organizationId,
          leadId,
          tasks.map((t) => t.id)
        )
        await deletePipelineMeetingsNotInSet(
          organizationId,
          leadId,
          meetings.map((m) => m.id)
        )
      }
    }
  }

  let tasksUpserted = 0
  let meetingsUpserted = 0
  if (!dryRun) {
    for (let i = 0; i < taskBatch.length; i += batchSize) {
      const part = await upsertPipelineTasks(taskBatch.slice(i, i + batchSize))
      tasksUpserted += part.upserted || 0
    }
    for (let i = 0; i < meetingBatch.length; i += batchSize) {
      const part = await upsertPipelineMeetings(meetingBatch.slice(i, i + batchSize))
      meetingsUpserted += part.upserted || 0
    }
  } else {
    tasksUpserted = taskBatch.length
    meetingsUpserted = meetingBatch.length
  }

  return { scanned: entries.length, tasksUpserted, meetingsUpserted, source: 'shard' }
}

export async function backfillPipelineCrmEntitiesForOrg(orgId, options = {}) {
  if (!isSupabaseEnabled()) throw new Error('Supabase is not configured')
  if (!pipelineTasksTableActive() || !pipelineMeetingsTableActive()) {
    throw new Error('pipeline_tasks / pipeline_meetings table path disabled')
  }
  if (!orgId) throw new Error('orgId is required')

  const shardName = pipelineOrgShardName(orgId)
  const started = Date.now()

  let result
  try {
    const probe = await supabaseRest(
      `${LEADS_TABLE}?shard_name=eq.${encodeURIComponent(shardName)}&select=lead_id&limit=1`,
      {},
      { timeoutMs: 20_000 }
    )
    if (Array.isArray(probe) && probe.length) {
      result = await backfillEntitiesFromPipelineLeads(shardName, orgId, options)
    } else {
      result = await backfillEntitiesFromShard(shardName, orgId, options)
    }
  } catch {
    result = await backfillEntitiesFromShard(shardName, orgId, options)
  }

  return {
    organizationId: orgId,
    shardName,
    ...result,
    durationMs: Date.now() - started,
  }
}

export async function backfillAllPipelineCrmEntities(options = {}) {
  const store = await readStore({ only: ['organizations'] })
  const orgs = options.orgId
    ? (store.organizations || []).filter((o) => o.id === options.orgId)
    : store.organizations || []

  const results = []
  for (const org of orgs) {
    if (!org?.id) continue
    results.push(await backfillPipelineCrmEntitiesForOrg(org.id, options))
  }
  return results
}

export async function verifyPipelineCrmEntitiesBackfill({ orgId = null } = {}) {
  const store = await readStore({ only: ['organizations'] })
  const orgs = orgId
    ? (store.organizations || []).filter((o) => o.id === orgId)
    : store.organizations || []

  const checks = []
  for (const org of orgs) {
    if (!org?.id) continue
    const shardName = pipelineOrgShardName(org.id)
    let shardTaskCount = 0
    let shardMeetingCount = 0
    try {
      const entries = await readPipelineShardEntries(shardName, { bypassCache: true })
      const counts = countCrmEntities(entries)
      shardTaskCount = counts.taskCount
      shardMeetingCount = counts.meetingCount
    } catch (error) {
      checks.push({ organizationId: org.id, ok: false, error: error?.message || String(error) })
      continue
    }

    let tableTaskCount = 0
    let tableMeetingCount = 0
    try {
      const taskRows = await supabaseRest(
        `${TASKS_TABLE}?organization_id=eq.${encodeURIComponent(org.id)}&select=task_id`,
        {},
        { timeoutMs: 30_000 }
      )
      tableTaskCount = Array.isArray(taskRows) ? taskRows.length : 0
      const meetingRows = await supabaseRest(
        `${MEETINGS_TABLE}?organization_id=eq.${encodeURIComponent(org.id)}&select=meeting_id`,
        {},
        { timeoutMs: 30_000 }
      )
      tableMeetingCount = Array.isArray(meetingRows) ? meetingRows.length : 0
    } catch (error) {
      checks.push({ organizationId: org.id, ok: false, error: error?.message || String(error) })
      continue
    }

    checks.push({
      organizationId: org.id,
      ok: tableTaskCount >= shardTaskCount && tableMeetingCount >= shardMeetingCount,
      shardTaskCount,
      tableTaskCount,
      shardMeetingCount,
      tableMeetingCount,
    })
  }

  const ok = checks.every((c) => c.ok)
  return { ok, checks }
}
