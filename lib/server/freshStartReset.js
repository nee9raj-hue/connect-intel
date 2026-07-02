/**
 * Production fresh start — wipe all org/user CRM data while keeping the app runnable.
 * Ops-only: bypasses assertSafeWrite via direct Supabase REST (never use updateStore for wipe).
 */

import { ensureMeilisearchIndex, meiliEnabled } from './meilisearch/client.js'
import { MEILI_CRM_INDEX } from './meilisearch/indexes.js'
import {
  fetchAllCollections,
  fetchStoreCollectionJson,
  isSupabaseEnabled,
  supabaseRest,
  upsertCollection,
} from './supabaseClient.js'
import { COLLECTIONS } from './store.js'

const CORE_COLLECTION_SET = new Set(COLLECTIONS)

const DEFAULT_PLATFORM = [{ inviteGmailOAuth: null }]

/** SQL tables cleared in dependency order (children before parents). */
const SQL_TABLES = [
  { table: 'campaign_events', pk: 'id' },
  { table: 'campaign_recipients', pk: 'id' },
  { table: 'campaign_stats', pk: 'id' },
  { table: 'campaigns_v3', pk: 'id' },
  { table: 'bulk_email_recipients', pk: 'id' },
  { table: 'bulk_email_sends', pk: 'id' },
  { table: 'marketing_email_queue', pk: 'id' },
  { table: 'marketing_campaign_batches', pk: 'id' },
  { table: 'marketing_analytics_snapshots', pk: 'id' },
  { table: 'email_activity_queue', pk: 'id' },
  { table: 'pipeline_activities', pk: 'id' },
  { table: 'pipeline_meetings', pk: 'id' },
  { table: 'pipeline_tasks', pk: 'id' },
  { table: 'pipeline_notes', pk: 'id' },
  { table: 'pipeline_deals', pk: 'id' },
  { table: 'pipeline_companies', pk: 'id' },
  { table: 'pipeline_leads', pk: 'id' },
  { table: 'organizations', pk: 'id' },
]

const DYNAMIC_COLLECTION_PREFIXES = [
  'pipeline_org_',
  'pipeline_user_',
  'pipeline_index_',
  'menroll_',
  'mcstat_',
  'mcamp_',
  'dashboard_snapshot_',
  'pipeline_snapshot_',
  'marketing_snapshot_',
  'team_snapshot_',
  'activity_snapshot_',
  'myday_snapshot_',
  'rep_snapshot_',
]

function isMissingTableError(error) {
  const msg = String(error?.message || '')
  return /relation.*does not exist|42P01|not found|schema cache/i.test(msg)
}

async function countTableRows(table, pk = 'id') {
  const path = `${table}?select=${encodeURIComponent(pk)}&limit=0`
  const url = `${process.env.SUPABASE_URL?.replace(/\/$/, '')}/rest/v1/${path}`
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    ''
  const res = await fetch(url, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: 'count=exact',
    },
    signal: AbortSignal.timeout(60_000),
  })
  if (!res.ok) {
    const text = await res.text()
    let data = null
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
    const err = new Error(data?.message || data?.error || `Count failed (${res.status})`)
    if (isMissingTableError(err) || res.status === 404) {
      return { count: 0, missing: true }
    }
    throw err
  }
  const range = res.headers.get('content-range') || ''
  const match = range.match(/\/(\d+)$/)
  return { count: match ? Number(match[1]) : 0, missing: false }
}

async function deleteTableBatch(table, pk = 'id', batchSize = 2000) {
  return supabaseRest(
    `${table}?${encodeURIComponent(pk)}=not.is.null&limit=${batchSize}`,
    {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' },
    },
    { timeoutMs: 120_000, attempts: 2 }
  )
}

async function clearSqlTable({ table, pk }, { dryRun, batchSize, onProgress }) {
  let counted = 0
  try {
    const { count, missing } = await countTableRows(table, pk)
    if (missing) {
      return { table, skipped: true, reason: 'table_missing', deleted: 0 }
    }
    counted = count
  } catch (error) {
    if (isMissingTableError(error)) {
      return { table, skipped: true, reason: 'table_missing', deleted: 0 }
    }
    throw error
  }

  if (dryRun) {
    return { table, dryRun: true, rowsBefore: counted, deleted: 0 }
  }

  let deleted = 0
  let remaining = counted
  let stuckPasses = 0
  const maxLoops = Math.ceil(counted / batchSize) + 50

  for (let loop = 0; loop < maxLoops && remaining > 0; loop += 1) {
    const before = remaining
    try {
      await deleteTableBatch(table, pk, batchSize)
    } catch (error) {
      if (isMissingTableError(error)) {
        return { table, skipped: true, reason: 'table_missing', deleted }
      }
      throw error
    }
    await delay(200)
    const next = await countTableRows(table, pk)
    remaining = next.count
    deleted += Math.max(0, before - remaining)
    onProgress?.({ table, remaining })
    if (remaining >= before) {
      stuckPasses += 1
      if (stuckPasses >= 3) {
        throw new Error(`Unable to clear ${table} — ${remaining} row(s) remain after deletes`)
      }
    } else {
      stuckPasses = 0
    }
  }

  return { table, deleted, rowsAfter: remaining }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isDynamicShardCollection(name) {
  if (!name || CORE_COLLECTION_SET.has(name)) return false
  return DYNAMIC_COLLECTION_PREFIXES.some((prefix) => name.startsWith(prefix))
}

async function deleteStoreCollectionRow(collection) {
  await supabaseRest(
    `store_collections?collection=eq.${encodeURIComponent(collection)}`,
    {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' },
    },
    { timeoutMs: 60_000 }
  )
}

async function buildPlatformPreserve({ preservePlatform }) {
  if (!preservePlatform) return DEFAULT_PLATFORM
  const rows = await fetchStoreCollectionJson('platform')
  const row = rows?.[0]
  if (!row?.inviteGmailOAuth) return DEFAULT_PLATFORM
  return [{ inviteGmailOAuth: row.inviteGmailOAuth }]
}

async function clearMeilisearchIndex({ dryRun }) {
  if (!meiliEnabled()) {
    return { skipped: true, reason: 'meilisearch_disabled' }
  }
  if (dryRun) {
    return { dryRun: true, action: 'delete_and_recreate_index', index: MEILI_CRM_INDEX }
  }
  const cfg = await import('./infra/config.js').then((m) => m.getMeilisearchConfig())
  if (!cfg) return { skipped: true, reason: 'meilisearch_not_configured' }
  const base = cfg.host.replace(/\/$/, '')
  const headers = {
    Authorization: `Bearer ${cfg.apiKey}`,
    'Content-Type': 'application/json',
  }
  try {
    await fetch(`${base}/indexes/${MEILI_CRM_INDEX}`, {
      method: 'DELETE',
      headers,
      signal: AbortSignal.timeout(30_000),
    })
  } catch {
    // index may not exist
  }
  await ensureMeilisearchIndex(MEILI_CRM_INDEX)
  return { cleared: true, index: MEILI_CRM_INDEX }
}

async function auditStoreCollections() {
  const rows = await fetchAllCollections('store_collections?select=collection,json', {
    timeoutMs: 120_000,
  })
  const names = rows.map((r) => r.collection).filter(Boolean)
  const core = {}
  const dynamic = []
  let totalJsonItems = 0
  for (const row of rows) {
    const name = row.collection
    const size = Array.isArray(row.json) ? row.json.length : 0
    totalJsonItems += size
    if (CORE_COLLECTION_SET.has(name)) {
      core[name] = size
    } else if (isDynamicShardCollection(name) || !CORE_COLLECTION_SET.has(name)) {
      dynamic.push({ collection: name, size })
    }
  }
  return { names, core, dynamic, totalJsonItems, collectionCount: names.length }
}

async function resetStoreCollections({ dryRun, preservePlatform, onProgress }) {
  const audit = await auditStoreCollections()
  const platformJson = await buildPlatformPreserve({ preservePlatform })

  if (dryRun) {
    return {
      dryRun: true,
      collectionCount: audit.collectionCount,
      totalJsonItems: audit.totalJsonItems,
      core: audit.core,
      dynamicShards: audit.dynamic.length,
      preservePlatform: Boolean(preservePlatform && platformJson[0]?.inviteGmailOAuth),
    }
  }

  const deletedDynamic = []
  for (const { collection } of audit.dynamic) {
    await deleteStoreCollectionRow(collection)
    deletedDynamic.push(collection)
    onProgress?.({ step: 'delete_shard', collection })
    await delay(50)
  }

  for (const collection of COLLECTIONS) {
    const json = collection === 'platform' ? platformJson : []
    await upsertCollection(collection, json)
    onProgress?.({ step: 'reset_core', collection })
    await delay(30)
  }

  const leftover = await fetchAllCollections('store_collections?select=collection', {
    timeoutMs: 60_000,
  })
  const leftoverNames = leftover
    .map((r) => r.collection)
    .filter((name) => name && !CORE_COLLECTION_SET.has(name))
  for (const collection of leftoverNames) {
    await deleteStoreCollectionRow(collection)
    deletedDynamic.push(collection)
  }

  return {
    resetCoreCollections: COLLECTIONS.length,
    deletedDynamic: deletedDynamic.length,
    preservedPlatformOAuth: Boolean(platformJson[0]?.inviteGmailOAuth),
  }
}

export async function runFreshStartReset(options = {}) {
  const dryRun = options.dryRun !== false
  const preservePlatform = options.preservePlatform !== false
  const batchSize = Math.min(5000, Math.max(500, Number(options.batchSize) || 2000))
  const onProgress = options.onProgress

  if (!isSupabaseEnabled()) {
    throw new Error('Supabase is not configured (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).')
  }

  const report = {
    ok: true,
    dryRun,
    preservePlatform,
    startedAt: new Date().toISOString(),
    sql: [],
    store: null,
    meilisearch: null,
    verify: null,
  }

  for (const spec of SQL_TABLES) {
    const result = await clearSqlTable(spec, { dryRun, batchSize, onProgress })
    report.sql.push(result)
    onProgress?.({ step: 'sql_table_done', ...result })
  }

  report.store = await resetStoreCollections({ dryRun, preservePlatform, onProgress })
  report.meilisearch = await clearMeilisearchIndex({ dryRun })

  if (!dryRun) {
    const users = (await fetchStoreCollectionJson('users')).length
    const orgs = (await fetchStoreCollectionJson('organizations')).length
    const leads = (await fetchStoreCollectionJson('savedLeads')).length
    let pipelineRows = 0
    try {
      const { count } = await countTableRows('pipeline_leads')
      pipelineRows = count
    } catch {
      pipelineRows = -1
    }
    report.verify = {
      users,
      organizations: orgs,
      savedLeads: leads,
      pipelineLeads: pipelineRows,
      clean: users === 0 && orgs === 0 && leads === 0 && pipelineRows === 0,
    }
    report.ok = report.verify.clean
  }

  report.finishedAt = new Date().toISOString()
  return report
}

export function assertFreshStartAuthorized(options = {}) {
  const execute = options.execute === true
  const confirm =
    options.confirm === true ||
    String(options.confirmEnv || process.env.FRESH_START_CONFIRM || '')
      .trim()
      .toLowerCase() === 'yes'
  if (!execute) {
    return { ok: true, mode: 'dry_run' }
  }
  if (!confirm) {
    throw new Error(
      'Refusing to execute: set FRESH_START_CONFIRM=yes (or pass freshStartConfirm=yes in the request body).'
    )
  }
  return { ok: true, mode: 'execute' }
}
