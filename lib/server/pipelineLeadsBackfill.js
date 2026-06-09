import { isSupabaseEnabled, supabaseRest } from './supabaseClient.js'
import {
  pipelineOrgShardName,
  pipelineUserShardName,
  readPipelineShardEntries,
} from './pipelineShard.js'
import { readStore } from './store.js'
import { upsertPipelineLeadRows } from './pipelineLeadsTable.js'

const TABLE = 'pipeline_leads'

/** List pipeline shard collection names that exist in store_collections. */
export async function discoverPipelineShardNames() {
  const rows = await supabaseRest(
    'store_collections?select=collection&or=(collection.like.*pipeline_org*,collection.like.*pipeline_user*)',
    {},
    { timeoutMs: 60_000 }
  )
  if (!Array.isArray(rows)) return []
  return rows.map((r) => r.collection).filter(Boolean).sort()
}

/** Shards to backfill from org/user metadata (may include empty shards). */
export async function listPipelineShardsFromMeta({ orgId = null } = {}) {
  const store = await readStore({ only: ['organizations', 'users'] })
  const shards = new Set()

  const orgs = orgId
    ? (store.organizations || []).filter((o) => o.id === orgId)
    : store.organizations || []

  for (const org of orgs) {
    if (org?.id) shards.add(pipelineOrgShardName(org.id))
  }

  if (!orgId) {
    for (const user of store.users || []) {
      if (user.organizationId && user.accountType === 'company') continue
      if (user?.id) shards.add(pipelineUserShardName(user.id))
    }
  }

  return [...shards].sort()
}

export async function countPipelineLeadsInTable(shardName) {
  let total = 0
  let offset = 0
  const limit = 1000

  while (true) {
    const rows = await supabaseRest(
      `${TABLE}?shard_name=eq.${encodeURIComponent(shardName)}&select=lead_id&offset=${offset}&limit=${limit}`,
      {},
      { timeoutMs: 30_000 }
    )
    if (!Array.isArray(rows) || !rows.length) break
    total += rows.length
    if (rows.length < limit) break
    offset += limit
  }

  return total
}

/**
 * Copy all entries from a pipeline_org_* / pipeline_user_* shard into pipeline_leads.
 */
export async function backfillPipelineShard(shardName, options = {}) {
  const { dryRun = false, batchSize = 50, bypassCache = true } = options
  const started = Date.now()

  const entries = (await readPipelineShardEntries(shardName, { bypassCache })) || []
  if (!entries.length) {
    return {
      shardName,
      shardRows: 0,
      upserted: 0,
      skipped: 0,
      tableRows: await countPipelineLeadsInTable(shardName),
      dryRun,
      durationMs: Date.now() - started,
    }
  }

  if (dryRun) {
    const valid = entries.filter((e) => e && (e.lead?.id || e.leadId || e.id))
    return {
      shardName,
      shardRows: entries.length,
      upserted: valid.length,
      skipped: entries.length - valid.length,
      tableRows: await countPipelineLeadsInTable(shardName),
      dryRun: true,
      durationMs: Date.now() - started,
    }
  }

  const result = await upsertPipelineLeadRows(shardName, entries, { batchSize, force: true })
  const tableRows = await countPipelineLeadsInTable(shardName)

  return {
    shardName,
    shardRows: entries.length,
    upserted: result.upserted,
    skipped: result.skipped,
    tableRows,
    dryRun: false,
    durationMs: Date.now() - started,
    inSync: tableRows >= entries.length - (result.skipped || 0),
  }
}

/** Backfill one org (company pipeline shard). */
export async function backfillOrganization(orgId, options = {}) {
  const shardName = pipelineOrgShardName(orgId)
  return backfillPipelineShard(shardName, options)
}

/**
 * Backfill all known pipeline shards.
 * Uses store_collections discovery when available; falls back to org/user list.
 */
export async function backfillAllPipelineShards(options = {}) {
  if (!isSupabaseEnabled()) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
  }

  const { orgId = null } = options
  let shardNames = []

  try {
    const discovered = await discoverPipelineShardNames()
    shardNames = orgId
      ? discovered.filter((n) => n === pipelineOrgShardName(orgId))
      : discovered
  } catch {
    shardNames = []
  }

  if (!shardNames.length) {
    shardNames = await listPipelineShardsFromMeta({ orgId })
  }

  const results = []
  for (const shardName of shardNames) {
    const row = await backfillPipelineShard(shardName, options)
    results.push(row)
  }

  const totals = results.reduce(
    (acc, r) => {
      acc.shardRows += r.shardRows || 0
      acc.upserted += r.upserted || 0
      acc.skipped += r.skipped || 0
      acc.tableRows += r.tableRows || 0
      if (r.inSync === false) acc.outOfSync += 1
      return acc
    },
    { shardRows: 0, upserted: 0, skipped: 0, tableRows: 0, outOfSync: 0 }
  )

  return { shards: results, totals, shardCount: results.length }
}

/** Compare shard row count vs pipeline_leads without writing. */
export async function verifyPipelineLeadsBackfill({ orgId = null } = {}) {
  const { totals, shards } = await backfillAllPipelineShards({ orgId, dryRun: true })
  const mismatches = []

  for (const shard of shards) {
    const tableCount = shard.tableRows ?? 0
    const expected = shard.shardRows - (shard.skipped || 0)
    if (tableCount < expected) {
      mismatches.push({
        shardName: shard.shardName,
        shardRows: shard.shardRows,
        expectedInTable: expected,
        tableRows: tableCount,
        missing: expected - tableCount,
      })
    }
  }

  return {
    ok: mismatches.length === 0,
    totals,
    mismatches,
    shardCount: shards.length,
  }
}
