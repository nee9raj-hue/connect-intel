import { isSupabaseEnabled, supabaseRest } from './supabaseClient.js'
import { pipelineOrgShardName, readPipelineShardEntries } from './pipelineShard.js'
import { readStore } from './store.js'
const LEADS_TABLE = 'pipeline_leads'
const ACTIVITIES_TABLE = 'pipeline_activities'

function resolveEntryCrm(entry) {
  if (entry?.crm && typeof entry.crm === 'object') return entry.crm
  if (entry?.lead?.crm && typeof entry.lead.crm === 'object') return entry.lead.crm
  if (entry?.entry?.crm && typeof entry.entry.crm === 'object') return entry.entry.crm
  return {}
}

function leadMeta(entry) {
  const lead = entry.lead || entry.entry?.lead || entry
  const leadId = lead?.id || entry.lead_id || entry.leadId || entry.id
  const leadName =
    [lead?.firstName, lead?.lastName].filter(Boolean).join(' ') || lead?.company || null
  return { leadId, leadName, company: lead?.company || null }
}

function activityRowsForEntry(organizationId, entry) {
  const { leadId, leadName, company } = leadMeta(entry)
  if (!organizationId || !leadId) return []

  const crm = resolveEntryCrm(entry)
  const acts = Array.isArray(crm.activities) ? crm.activities : []
  return acts
    .filter((a) => a?.createdAt)
    .map((activity) => ({
      organization_id: String(organizationId),
      lead_id: String(leadId),
      actor_id: activity.createdByUserId || activity.userId || null,
      type: String(activity.type || 'note'),
      summary: String(activity.summary || '').slice(0, 500),
      occurred_at: activity.createdAt,
      payload: {
        activityId: activity.id || null,
        createdByName: activity.createdByName || activity.userName || null,
        leadName,
        company,
        meta: activity.meta || null,
      },
    }))
}

async function countActivitiesForOrg(orgId) {
  const rows = await supabaseRest(
    `${ACTIVITIES_TABLE}?organization_id=eq.${encodeURIComponent(orgId)}&select=id&limit=1`,
    {},
    { timeoutMs: 30_000 }
  )
  return Array.isArray(rows) ? rows.length : 0
}

async function insertActivityBatch(rows, { dryRun = false } = {}) {
  if (!rows.length) return 0
  if (dryRun) return rows.length

  await supabaseRest(`${ACTIVITIES_TABLE}`, {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(rows),
  }, { timeoutMs: 60_000 })

  return rows.length
}

async function backfillFromPipelineLeadsTable(shardName, organizationId, options = {}) {
  const { dryRun = false, batchSize = 100, sinceMs = 0 } = options
  let offset = 0
  let scanned = 0
  let inserted = 0
  const pageSize = 100

  while (true) {
    const rows = await supabaseRest(
      `${LEADS_TABLE}?shard_name=eq.${encodeURIComponent(shardName)}&select=lead_id,entry&order=updated_at.desc&offset=${offset}&limit=${pageSize}`,
      {},
      { timeoutMs: 60_000 }
    )
    if (!Array.isArray(rows) || !rows.length) break

    const batch = []
    for (const row of rows) {
      scanned += 1
      const entry = row.entry && typeof row.entry === 'object' ? row.entry : {}
      const payloadRows = activityRowsForEntry(organizationId, entry)
      for (const act of payloadRows) {
        const t = new Date(act.occurred_at).getTime()
        if (sinceMs && (Number.isNaN(t) || t < sinceMs)) continue
        batch.push(act)
      }
    }

    for (let i = 0; i < batch.length; i += batchSize) {
      inserted += await insertActivityBatch(batch.slice(i, i + batchSize), { dryRun })
    }

    if (rows.length < pageSize) break
    offset += pageSize
  }

  return { scanned, inserted, source: 'pipeline_leads' }
}

async function backfillFromShard(shardName, organizationId, options = {}) {
  const { dryRun = false, batchSize = 100, sinceMs = 0, bypassCache = true } = options
  const entries = (await readPipelineShardEntries(shardName, { bypassCache })) || []
  let inserted = 0
  const batch = []

  for (const entry of entries) {
    const payloadRows = activityRowsForEntry(organizationId, entry)
    for (const act of payloadRows) {
      const t = new Date(act.occurred_at).getTime()
      if (sinceMs && (Number.isNaN(t) || t < sinceMs)) continue
      batch.push(act)
    }
  }

  for (let i = 0; i < batch.length; i += batchSize) {
    inserted += await insertActivityBatch(batch.slice(i, i + batchSize), { dryRun })
  }

  return { scanned: entries.length, inserted, source: 'shard' }
}

export async function backfillPipelineActivitiesForOrg(orgId, options = {}) {
  if (!isSupabaseEnabled()) throw new Error('Supabase is not configured')
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
      result = await backfillFromPipelineLeadsTable(shardName, orgId, options)
    } else {
      result = await backfillFromShard(shardName, orgId, options)
    }
  } catch {
    result = await backfillFromShard(shardName, orgId, options)
  }

  return {
    organizationId: orgId,
    shardName,
    ...result,
    durationMs: Date.now() - started,
  }
}

export async function backfillAllPipelineActivities(options = {}) {
  const store = await readStore({ only: ['organizations'] })
  const orgs = options.orgId
    ? (store.organizations || []).filter((o) => o.id === options.orgId)
    : store.organizations || []

  const results = []
  for (const org of orgs) {
    if (!org?.id) continue
    results.push(await backfillPipelineActivitiesForOrg(org.id, options))
  }
  return results
}

export async function verifyPipelineActivitiesBackfill({ orgId = null } = {}) {
  const store = await readStore({ only: ['organizations'] })
  const orgs = orgId
    ? (store.organizations || []).filter((o) => o.id === orgId)
    : store.organizations || []

  const rows = []
  for (const org of orgs) {
    const count = await countActivitiesForOrg(org.id)
    rows.push({ organizationId: org.id, name: org.name, activityRows: count })
  }

  const ok = rows.some((r) => r.activityRows > 0) || rows.every((r) => r.activityRows === 0)
  return { ok, rows }
}
