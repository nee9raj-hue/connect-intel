import { CRM_STATUSES, foldCrmStatusCounts, normalizeCrmLeadStatus } from './crm.js'
import { countDealsByStage } from '../dealPipeline.js'
import { collectPipelineLocationFacets, summarizePipelineEntries, pipelineOwnerUserId } from './pipelineQuery.js'
import { resolveOrgRole } from './organizations.js'
import { isFreightDealOrg } from '../freightDeal.js'
import { getOrganization } from './organizations.js'
import { listPipelineActorIds } from '../pipelineActorIds.js'
import { fetchStoreCollectionJson, isSupabaseEnabled, upsertCollection } from './supabaseClient.js'
import { readStore } from './store.js'
import { pipelineShardNameForUser } from './pipelineShard.js'
import { loadScopedPipelineStatusCounts } from './pipelineLeadCounts.js'
import { isPipelineHierarchyRbacEnabled } from './infra/config.js'

const SUMMARY_CACHE_MS = 60_000
const summaryCache = new Map()

export function pipelineIndexCollectionName(shardName) {
  return String(shardName || '').replace(/^pipeline_/, 'pipeline_index_')
}

export function isPipelineIndexCollection(name) {
  return typeof name === 'string' && name.startsWith('pipeline_index_')
}

function emptyByStatus() {
  return Object.fromEntries(CRM_STATUSES.map((s) => [s, 0]))
}

function summarizeAssigneeBucket(entries) {
  const byStatus = emptyByStatus()
  for (const e of entries) {
    const st = normalizeCrmLeadStatus(e.crm?.status)
    if (byStatus[st] != null) byStatus[st] += 1
    else byStatus.unqualified += 1
  }
  return {
    total: entries.length,
    byStatus: CRM_STATUSES.map((status) => ({ status, count: byStatus[status] || 0 })),
  }
}

/** Build precomputed summary from pipeline entries (in-memory; no CRM activity blobs in output). */
export function buildPipelineIndexDoc(entries, { freightOrg = false, organizationId = null } = {}) {
  const list = Array.isArray(entries) ? entries : []
  const summary = summarizePipelineEntries(list)
  const locations = collectPipelineLocationFacets(list)

  const byAssignee = {}
  const assigneeBuckets = new Map()
  for (const entry of list) {
    const owner = pipelineOwnerUserId(entry)
    if (!owner) continue
    const key = String(owner)
    if (!assigneeBuckets.has(key)) assigneeBuckets.set(key, [])
    assigneeBuckets.get(key).push(entry)
  }
  for (const [userId, bucket] of assigneeBuckets) {
    byAssignee[userId] = summarizeAssigneeBucket(bucket)
  }

  const doc = {
    version: 1,
    organizationId: organizationId || null,
    updatedAt: new Date().toISOString(),
    total: summary.total,
    byStatus: summary.byStatus,
    cities: locations.cities,
    states: locations.states,
    byAssignee,
    entryCount: list.length,
  }

  if (freightOrg) {
    doc.openDealCounts = countDealsByStage(list, { openOnly: true, freightOrg: true })
    doc.dealCounts = countDealsByStage(list, { openOnly: false, freightOrg: true })
  }

  return doc
}

export function applyPipelineSummaryForUser(doc, user, store) {
  if (!doc) return null
  const { orgRole, accountType } = resolveOrgRole(user, store)
  const isOrgMember =
    accountType === 'company' && user.organizationId && orgRole !== 'org_admin'

  if (!isOrgMember) {
    return {
      total: doc.total,
      byStatus: doc.byStatus,
      cities: doc.cities || [],
      states: doc.states || [],
      openDealCounts: doc.openDealCounts,
      dealCounts: doc.dealCounts,
      ready: true,
      fromIndex: true,
      updatedAt: doc.updatedAt,
    }
  }

  const actorIds = listPipelineActorIds(store, user.organizationId, user)
  const statusCounts = Object.fromEntries(CRM_STATUSES.map((status) => [status, 0]))
  let total = 0
  for (const id of actorIds) {
    const bucket = doc.byAssignee?.[id]
    if (!bucket) continue
    total += Number(bucket.total) || 0
    for (const row of bucket.byStatus || []) {
      const key = row.status
      if (statusCounts[key] != null) statusCounts[key] += Number(row.count) || 0
    }
  }

  if (total > 0) {
    return {
      total,
      byStatus: foldCrmStatusCounts(
        CRM_STATUSES.map((status) => ({ status, count: statusCounts[status] || 0 }))
      ),
      cities: doc.cities || [],
      states: doc.states || [],
      openDealCounts: doc.openDealCounts,
      dealCounts: doc.dealCounts,
      ready: true,
      fromIndex: true,
      updatedAt: doc.updatedAt,
    }
  }

  return {
    total: 0,
    byStatus: CRM_STATUSES.map((status) => ({ status, count: 0 })),
    cities: [],
    states: [],
    ready: true,
    fromIndex: true,
    updatedAt: doc.updatedAt,
  }
}

export async function readPipelineIndexDoc(shardName) {
  const collection = pipelineIndexCollectionName(shardName)
  const cached = summaryCache.get(collection)
  if (cached && Date.now() - cached.at < SUMMARY_CACHE_MS) {
    return cached.doc
  }

  let doc = null
  if (isSupabaseEnabled()) {
    const rows = await fetchStoreCollectionJson(collection)
    doc = rows?.[0] && typeof rows[0] === 'object' && !Array.isArray(rows[0]) ? rows[0] : null
  } else {
    const store = await readStore({ only: [collection] })
    const rows = store[collection]
    doc = rows?.[0] && typeof rows[0] === 'object' ? rows[0] : null
  }

  if (doc) {
    summaryCache.set(collection, { doc, at: Date.now() })
  }
  return doc
}

export async function writePipelineIndexDoc(shardName, doc) {
  const collection = pipelineIndexCollectionName(shardName)
  const payload = [doc]
  if (isSupabaseEnabled()) {
    await upsertCollection(collection, payload)
  } else {
    const { writeStoreCollections } = await import('./store.js')
    await writeStoreCollections({ [collection]: payload }, [collection])
  }
  summaryCache.set(collection, { doc, at: Date.now() })

  if (doc?.organizationId) {
    try {
      const { writePipelineSnapshotAlias } = await import('./dashboardSnapshots.js')
      await writePipelineSnapshotAlias(doc.organizationId, doc)
    } catch (err) {
      console.warn('pipeline snapshot alias write failed:', err?.message || err)
    }
  }
}

export function invalidatePipelineIndex(shardName) {
  summaryCache.delete(pipelineIndexCollectionName(shardName))
}

export async function refreshPipelineIndex(shardName, entries, options = {}) {
  if (!shardName) return null
  const doc = buildPipelineIndexDoc(entries, options)
  await writePipelineIndexDoc(shardName, doc)
  return doc
}

/** Attach city/state facets from the precomputed pipeline index (SQL counts omit these). */
export async function attachPipelineIndexLocationFacets(summary, user, store) {
  if (!summary) return summary

  const shardName = pipelineShardNameForUser(user)
  if (!shardName) return summary

  const doc = await readPipelineIndexDoc(shardName)
  if (!doc) return summary

  const scoped = applyPipelineSummaryForUser(doc, user, store)
  const cities = summary.cities?.length
    ? summary.cities
    : scoped?.cities?.length
      ? scoped.cities
      : doc.cities || []
  const states = summary.states?.length
    ? summary.states
    : scoped?.states?.length
      ? scoped.states
      : doc.states || []

  return {
    ...summary,
    cities,
    states,
    openDealCounts: summary.openDealCounts ?? scoped?.openDealCounts ?? doc.openDealCounts,
    dealCounts: summary.dealCounts ?? scoped?.dealCounts ?? doc.dealCounts,
  }
}

/** Fast summary: SQL scoped COUNTs → index doc → null (caller may scan shard). */
export async function loadPipelineSummaryFast(user, store, options = {}) {
  let summary = null
  if (isPipelineHierarchyRbacEnabled()) {
    summary = await loadScopedPipelineStatusCounts(user, store, options.filters || {})
  }

  const shardName = pipelineShardNameForUser(user)
  const doc = await readPipelineIndexDoc(shardName)
  const indexed = doc ? applyPipelineSummaryForUser(doc, user, store) : null
  if (!summary || ((Number(summary.total) || 0) === 0 && (Number(indexed?.total) || 0) > 0)) {
    if (!indexed && !summary) return null
    summary = (Number(indexed?.total) || 0) > (Number(summary?.total) || 0) ? indexed : summary || indexed
  }

  return attachSqlDealCountsToSummary(
    await attachPipelineIndexLocationFacets(summary, user, store),
    user,
    store,
    options
  )
}

async function attachSqlDealCountsToSummary(summary, user, store, options = {}) {
  if (!summary) return summary
  const org = user?.organizationId ? getOrganization(store, user.organizationId) : null
  if (!isFreightDealOrg(org, user)) return summary
  try {
    const { countScopedPipelineDealsByStage } = await import('./pipelineDealsTable.js')
    const counted = await countScopedPipelineDealsByStage(user, {
      freightOrg: true,
      filters: options.filters || {},
      metaStore: store,
    })
    if (!counted?.dealCounts) return summary
    const sqlAll = Number(counted.dealCounts.all) || 0
    const indexAll = Number(summary.dealCounts?.all) || 0
    if (sqlAll === 0 && indexAll > 0) return summary
    return {
      ...summary,
      dealCounts: counted.dealCounts,
      openDealCounts: counted.openDealCounts,
    }
  } catch {
    return summary
  }
}

export async function seedEmptyPipelineIndexForOrg(organizationId) {
  if (!organizationId) return null
  const shardName = `pipeline_${organizationId}`
  const doc = buildPipelineIndexDoc([], { organizationId })
  await writePipelineIndexDoc(shardName, doc)
  return doc
}

export async function ensurePipelineIndex(shardName, entries, user, store) {
  const org = user?.organizationId ? getOrganization(store, user.organizationId) : null
  const freightOrg = isFreightDealOrg(org, user)
  const doc = buildPipelineIndexDoc(entries, {
    freightOrg,
    organizationId: user?.organizationId || null,
  })
  await writePipelineIndexDoc(shardName, doc)
  return applyPipelineSummaryForUser(doc, user, store)
}
