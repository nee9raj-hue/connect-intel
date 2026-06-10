import { CRM_STATUSES } from './crm.js'
import { countDealsByStage } from '../dealPipeline.js'
import { collectPipelineLocationFacets, summarizePipelineEntries } from './pipelineQuery.js'
import { resolveOrgRole } from './organizations.js'
import { isFreightDealOrg } from '../freightDeal.js'
import { getOrganization } from './organizations.js'
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
    const st = e.crm?.status || 'new'
    if (byStatus[st] != null) byStatus[st] += 1
    else byStatus.new += 1
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
    const owner = entry.assignedToUserId || entry.savedByUserId || entry.userId
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

  const bucket = doc.byAssignee?.[user.id]
  if (bucket) {
    return {
      total: bucket.total,
      byStatus: bucket.byStatus,
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

/** Fast summary: SQL scoped COUNTs → index doc → null (caller may scan shard). */
export async function loadPipelineSummaryFast(user, store, options = {}) {
  if (isPipelineHierarchyRbacEnabled()) {
    const sqlSummary = await loadScopedPipelineStatusCounts(user, store, options.filters || {})
    if (sqlSummary) return sqlSummary
  }

  const shardName = pipelineShardNameForUser(user)
  const doc = await readPipelineIndexDoc(shardName)
  if (!doc) return null
  return applyPipelineSummaryForUser(doc, user, store)
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
