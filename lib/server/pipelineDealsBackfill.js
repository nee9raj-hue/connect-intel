import { pipelineOrgShardName, readPipelineShardEntries } from './pipelineShard.js'
import { isSupabaseEnabled, supabaseRest } from './supabaseClient.js'
import { readStore } from './store.js'
import {
  buildPipelineDealRow,
  deletePipelineDealsNotInSet,
  pipelineDealsTableActive,
  upsertPipelineDeals,
} from './pipelineDealsTable.js'
import { normalizeDealsList } from './crmWorkflow.js'

const LEADS_TABLE = 'pipeline_leads'
const DEALS_TABLE = 'pipeline_deals'

function resolveEntryCrm(entry) {
  if (entry?.crm && typeof entry.crm === 'object') return entry.crm
  if (entry?.entry?.crm && typeof entry.entry.crm === 'object') return entry.entry.crm
  return {}
}

function entryFromRow(row) {
  if (row?.entry && typeof row.entry === 'object') return row.entry
  return row
}

async function backfillFromPipelineLeads(shardName, organizationId, options = {}) {
  const { dryRun = false, batchSize = 50 } = options
  let offset = 0
  let scanned = 0
  let upserted = 0
  const pageSize = 80

  while (true) {
    const rows = await supabaseRest(
      `${LEADS_TABLE}?shard_name=eq.${encodeURIComponent(shardName)}` +
        `&select=lead_id,entry&order=updated_at.desc&offset=${offset}&limit=${pageSize}`,
      {},
      { timeoutMs: 60_000 }
    )
    if (!Array.isArray(rows) || !rows.length) break

    const batch = []
    for (const row of rows) {
      scanned += 1
      const entry = entryFromRow(row.entry)
      const deals = normalizeDealsList(resolveEntryCrm(entry).deals)
      for (const deal of deals) {
        const built = buildPipelineDealRow(organizationId, entry, deal)
        if (built) batch.push(built)
      }
      if (!dryRun && entry) {
        const leadId = entry.lead?.id || row.lead_id
        if (leadId) {
          await deletePipelineDealsNotInSet(
            organizationId,
            leadId,
            deals.map((d) => d.id)
          )
        }
      }
    }

    if (!dryRun) {
      for (let i = 0; i < batch.length; i += batchSize) {
        const part = await upsertPipelineDeals(batch.slice(i, i + batchSize))
        upserted += part.upserted || 0
      }
    } else {
      upserted += batch.length
    }

    if (rows.length < pageSize) break
    offset += pageSize
  }

  return { scanned, upserted, source: 'pipeline_leads' }
}

async function backfillFromShard(shardName, organizationId, options = {}) {
  const { dryRun = false, batchSize = 50, bypassCache = true } = options
  const entries = (await readPipelineShardEntries(shardName, { bypassCache })) || []
  const batch = []

  for (const entry of entries) {
    const deals = normalizeDealsList(entry.crm?.deals)
    for (const deal of deals) {
      const built = buildPipelineDealRow(organizationId, entry, deal)
      if (built) batch.push(built)
    }
    if (!dryRun) {
      const leadId = entry.lead?.id || entry.id
      if (leadId) {
        await deletePipelineDealsNotInSet(
          organizationId,
          leadId,
          deals.map((d) => d.id)
        )
      }
    }
  }

  let upserted = 0
  if (!dryRun) {
    for (let i = 0; i < batch.length; i += batchSize) {
      const part = await upsertPipelineDeals(batch.slice(i, i + batchSize))
      upserted += part.upserted || 0
    }
  } else {
    upserted = batch.length
  }

  return { scanned: entries.length, upserted, source: 'shard' }
}

export async function backfillPipelineDealsForOrg(orgId, options = {}) {
  if (!isSupabaseEnabled()) throw new Error('Supabase is not configured')
  if (!pipelineDealsTableActive()) throw new Error('pipeline_deals table path disabled')
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
      result = await backfillFromPipelineLeads(shardName, orgId, options)
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

export async function backfillAllPipelineDeals(options = {}) {
  const store = await readStore({ only: ['organizations'] })
  const orgs = options.orgId
    ? (store.organizations || []).filter((o) => o.id === options.orgId)
    : store.organizations || []

  const results = []
  for (const org of orgs) {
    if (!org?.id) continue
    results.push(await backfillPipelineDealsForOrg(org.id, options))
  }
  return results
}

export async function verifyPipelineDealsBackfill({ orgId = null } = {}) {
  const store = await readStore({ only: ['organizations'] })
  const orgs = orgId
    ? (store.organizations || []).filter((o) => o.id === orgId)
    : store.organizations || []

  const checks = []
  for (const org of orgs) {
    if (!org?.id) continue
    const shardName = pipelineOrgShardName(org.id)
    let shardDealCount = 0
    try {
      const entries = await readPipelineShardEntries(shardName, { bypassCache: true })
      for (const entry of entries || []) {
        shardDealCount += normalizeDealsList(entry.crm?.deals).length
      }
    } catch (error) {
      checks.push({ organizationId: org.id, ok: false, error: error?.message || String(error) })
      continue
    }

    let tableDealCount = 0
    try {
      const rows = await supabaseRest(
        `${DEALS_TABLE}?organization_id=eq.${encodeURIComponent(org.id)}&select=deal_id`,
        {},
        { timeoutMs: 30_000 }
      )
      tableDealCount = Array.isArray(rows) ? rows.length : 0
    } catch (error) {
      checks.push({ organizationId: org.id, ok: false, error: error?.message || String(error) })
      continue
    }

    checks.push({
      organizationId: org.id,
      ok: tableDealCount >= shardDealCount,
      shardDealCount,
      tableDealCount,
    })
  }

  const ok = checks.every((c) => c.ok)
  return { ok, checks }
}
