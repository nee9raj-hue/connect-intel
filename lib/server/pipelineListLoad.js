import { CRM_STATUSES } from './crm.js'
import { flattenDealsFromEntries } from '../dealPipeline.js'
import { listPipelinePage, listPipelineSavedEntries } from './organizations.js'
import { filterPipelineEntries } from './pipelineQuery.js'
import {
  attachPipelineIndexLocationFacets,
  loadPipelineSummaryFast,
  readPipelineIndexDoc,
} from './pipelineIndex.js'
import {
  attachPipelineEntriesToStore,
  loadPipelineStoreContext,
  META_STORE_COLLECTIONS,
  pipelineShardNameForUser,
} from './pipelineShard.js'
import {
  resolvePipelineTableScope,
  resolvePipelineTableScopeAsync,
  visiblePipelineFromEntries,
} from './pipelineTableScope.js'
import { readStore } from './store.js'
import { isPipelineHierarchyRbacEnabled } from './infra/config.js'
import { getScopedLeadsQuery, scopedLeadsListUrl } from './pipelineScopedQuery.js'
import { resolveManagerVisibleOwnerIds } from './pipelineManagerScope.js'
import { buildNextPipelineCursor } from './pipelineKeyset.js'
import { countScopedPipelineLeads } from './pipelineLeadCounts.js'
import { supabaseRest } from './supabaseClient.js'

export { resolvePipelineTableScope, resolvePipelineTableScopeAsync } from './pipelineTableScope.js'
export { getScopedLeadsQuery } from './pipelineScopedQuery.js'

/** Filters that require scanning all rows (shard or full table walk). */
export function hasHeavyPipelineListFilters(filters = {}) {
  return Boolean(
    String(filters.q || '').trim() ||
      (Array.isArray(filters.tagIds) && filters.tagIds.length) ||
      filters.stuck
  )
}

/** True when the only “heavy” filter is text search (Meili can handle). */
export function isMeiliSearchOnlyFilters(filters = {}) {
  const q = String(filters.q || '').trim()
  if (!q) return false
  return !hasHeavyPipelineListFilters({ ...filters, q: '' })
}

export async function resolveListTotalFromIndex(user, metaStore, shardName, filters = {}) {
  if (isPipelineHierarchyRbacEnabled()) {
    const sqlTotal = await countScopedPipelineLeads(user, metaStore, filters)
    if (sqlTotal != null) return sqlTotal
  }

  const doc = await readPipelineIndexDoc(shardName)
  if (!doc) return null

  const status = String(filters.status || 'all').trim()
  const assignee = String(filters.assigneeUserId || '').trim()

  if (assignee && assignee !== '__unassigned__') {
    const bucket = doc.byAssignee?.[assignee]
    if (!bucket) return 0
    if (status && status !== 'all' && CRM_STATUSES.includes(status)) {
      return bucket.byStatus?.find((row) => row.status === status)?.count ?? 0
    }
    return bucket.total ?? 0
  }

  if (assignee === '__unassigned__') return null

  const summary = applyPipelineSummaryForUser(doc, user, metaStore)
  if (!summary) return null

  if (status && status !== 'all' && CRM_STATUSES.includes(status)) {
    return summary.byStatus?.find((row) => row.status === status)?.count ?? 0
  }

  return summary.total ?? 0
}

function columnTotalsFromSummary(summary) {
  const totals = Object.fromEntries(CRM_STATUSES.map((s) => [s, 0]))
  for (const row of summary?.byStatus || []) {
    if (totals[row.status] != null) totals[row.status] = row.count || 0
  }
  return totals
}

async function loadPipelineListFromShard(user, { offset, limit, filters, light }) {
  const { pipelineStore, visible, shardName } = await loadPipelineStoreContext(user, {
    shardOnly: true,
  })
  const filtered = filterPipelineEntries(visible, filters)
  const { leads, total } = listPipelinePage(pipelineStore, user, {
    light,
    limit,
    offset,
    entries: filtered,
  })

  return {
    pipelineStore,
    visible,
    leads,
    total,
    limit,
    offset,
    hasMore: offset + leads.length < total,
    pipelineTotal: visible.length,
    fromTable: false,
    shardName,
  }
}

/**
 * HubSpot-style list view: scoped PostgREST page + indexed COUNT in parallel (<50ms target).
 * Rep → owner_id lock; manager → team_id (or department when scope=all_departments); admin → paginated org-wide.
 */
export async function loadScopedLeadsListView(
  user,
  { offset = 0, limit = 50, filters = {}, light = true, cursor = null } = {}
) {
  const { pipelineLeadsTableActive } = await import('./pipelineLeadsTable.js')
  if (!pipelineLeadsTableActive() || !isPipelineHierarchyRbacEnabled()) return null
  if (hasHeavyPipelineListFilters(filters)) return null

  const metaStore = await readStore({ only: META_STORE_COLLECTIONS })
  const off = cursor ? 0 : Math.max(0, Math.floor(Number(offset) || 0))
  const lim = Math.max(1, Math.floor(Number(limit) || 50))
  const scoped = await getScopedLeadsQuery(
    user,
    { ...filters, offset: off, limit: lim, cursor: cursor || filters.cursor },
    metaStore
  )
  const shardName = scoped.shardName

  const [rows, total] = await Promise.all([
    supabaseRest(scopedLeadsListUrl(scoped), {}, { timeoutMs: 8_000, attempts: 2 }),
    countScopedPipelineLeads(user, metaStore, filters),
  ])

  if (!Array.isArray(rows) || total == null) return null

  const nextCursor = buildNextPipelineCursor(rows, scoped.pagination.limit)
  const entries = rows.map((r) => r.entry).filter(Boolean)
  const pipelineStore = attachPipelineEntriesToStore(metaStore, entries)
  const visibleOwnerIds = await resolveManagerVisibleOwnerIds(user, metaStore)
  const visible = listPipelineSavedEntries(pipelineStore, user, { visibleOwnerIds })
  const pageEntries = filterPipelineEntries(visible, filters)
  const { leads } = listPipelinePage(pipelineStore, user, {
    light,
    limit: scoped.pagination.limit,
    offset: 0,
    entries: pageEntries,
  })

  return {
    pipelineStore,
    visible: pageEntries,
    leads,
    total,
    limit: scoped.pagination.limit,
    offset: scoped.pagination.offset,
    hasMore: Boolean(nextCursor) || scoped.pagination.offset + leads.length < total,
    nextCursor,
    pipelineTotal: total,
    fromTable: true,
    fromSqlScope: true,
    scopeRole: scoped.role,
    shardName,
  }
}

/**
 * Pipeline list search via Meilisearch → visible lead IDs → by-ID load (no full shard scan).
 */
async function loadPipelineListFromMeili(user, { offset = 0, limit = 50, filters = {}, light = true } = {}) {
  if (!isMeiliSearchOnlyFilters(filters)) return null

  const metaStore = await readStore({ only: META_STORE_COLLECTIONS })
  const { searchVisiblePipelineLeadIds } = await import('./meilisearch/pipelineListSearch.js')
  const leadIds = await searchVisiblePipelineLeadIds(user, metaStore, filters.q, { limit: 2000 })
  if (leadIds === null) return null

  const off = Math.max(0, Math.floor(Number(offset) || 0))
  const lim = Math.max(1, Math.floor(Number(limit) || 50))
  const shardName = pipelineShardNameForUser(user)

  if (!leadIds.length) {
    const pipelineStore = attachPipelineEntriesToStore(metaStore, [])
    return {
      pipelineStore,
      visible: [],
      leads: [],
      total: 0,
      limit: lim,
      offset: off,
      hasMore: false,
      pipelineTotal: 0,
      fromTable: false,
      fromMeili: true,
      shardName,
    }
  }

  const { pipelineLeadsTableActive, readPipelineLeadsByIds } = await import('./pipelineLeadsTable.js')
  const { filterPipelineEntriesVisibleAsync } = await import('./pipelineVisibility.js')
  const { loadPipelineStoreForLeadIds } = await import('./pipelineShard.js')

  let visible = []
  if (pipelineLeadsTableActive()) {
    const entries = (await readPipelineLeadsByIds(shardName, leadIds)) || []
    visible = await filterPipelineEntriesVisibleAsync(user, entries, metaStore)
  } else {
    const loaded = await loadPipelineStoreForLeadIds(user, leadIds)
    visible = loaded.visible || []
  }

  const orderMap = new Map(leadIds.map((id, index) => [id, index]))
  visible.sort(
    (a, b) =>
      (orderMap.get(a.lead?.id) ?? 999999) - (orderMap.get(b.lead?.id) ?? 999999)
  )

  const filtered = filterPipelineEntries(visible, filters)
  const total = filtered.length
  const pageEntries = filtered.slice(off, off + lim)
  const pipelineStore = attachPipelineEntriesToStore(metaStore, pageEntries)
  const { leads } = listPipelinePage(pipelineStore, user, {
    light,
    limit: lim,
    offset: 0,
    entries: pageEntries,
  })

  return {
    pipelineStore,
    visible: pageEntries,
    leads,
    total,
    limit: lim,
    offset: off,
    hasMore: off + pageEntries.length < total,
    pipelineTotal: total,
    fromTable: pipelineLeadsTableActive(),
    fromMeili: true,
    shardName,
  }
}

/**
 * Paginated pipeline list — SQL scope fast path when enabled; table page + index totals otherwise.
 */
export async function loadPipelineListPage(
  user,
  { offset = 0, limit = 50, filters = {}, light = true, cursor = null } = {}
) {
  const scopedView = await loadScopedLeadsListView(user, {
    offset,
    limit,
    filters,
    light,
    cursor: cursor || filters.cursor,
  })
  if (scopedView) return scopedView

  const off = Math.max(0, Math.floor(Number(offset) || 0))
  const lim = Math.max(1, Math.floor(Number(limit) || 50))

  if (isMeiliSearchOnlyFilters(filters)) {
    const meiliView = await loadPipelineListFromMeili(user, {
      offset: off,
      limit: lim,
      filters,
      light,
    })
    if (meiliView) return meiliView
  }

  const metaStore = await readStore({ only: META_STORE_COLLECTIONS })
  const shardName = pipelineShardNameForUser(user)

  const { pipelineLeadsTableActive, readPipelineLeadsScopedPage } = await import('./pipelineLeadsTable.js')

  if (!pipelineLeadsTableActive() || hasHeavyPipelineListFilters(filters)) {
    return loadPipelineListFromShard(user, { offset: off, limit: lim, filters, light })
  }

  const summary = await loadPipelineSummaryFast(user, metaStore, { filters })
  if (!summary) {
    return loadPipelineListFromShard(user, { offset: off, limit: lim, filters, light })
  }

  const scope = resolvePipelineTableScope(user, metaStore, filters)
  const status = String(filters.status || 'all').trim()
  const entries = await readPipelineLeadsScopedPage(
    shardName,
    scope,
    { offset: off, limit: lim, status, ...filters },
    user,
    metaStore
  )

  if (entries === null) {
    return loadPipelineListFromShard(user, { offset: off, limit: lim, filters, light })
  }

  const pipelineStore = attachPipelineEntriesToStore(metaStore, entries)
  const visible = listPipelineSavedEntries(pipelineStore, user)
  const pageEntries = filterPipelineEntries(visible, filters)
  const { leads } = listPipelinePage(pipelineStore, user, {
    light,
    limit: lim,
    offset: 0,
    entries: pageEntries,
  })

  const total = await resolveListTotalFromIndex(user, metaStore, shardName, filters)
  if (total == null) {
    return loadPipelineListFromShard(user, { offset: off, limit: lim, filters, light })
  }

  const pipelineTotal = summary.total ?? total

  return {
    pipelineStore,
    visible: pageEntries,
    leads,
    total,
    limit: lim,
    offset: off,
    hasMore: off + leads.length < total,
    pipelineTotal,
    fromTable: true,
    shardName,
  }
}

/**
 * Board view — index column totals + per-status table pages (no full shard blob).
 * Returns null when heavy filters or unassigned bucket need a full scan.
 */
export async function loadPipelineBoardView(
  user,
  { filters = {}, columnLimits = {}, defaultPerColumn = 50 } = {}
) {
  if (hasHeavyPipelineListFilters(filters)) return null
  if (String(filters.assigneeUserId || '').trim() === '__unassigned__') return null

  const metaStore = await readStore({ only: META_STORE_COLLECTIONS })
  const shardName = pipelineShardNameForUser(user)
  const { pipelineLeadsTableActive, readPipelineLeadsScopedPage } = await import('./pipelineLeadsTable.js')
  if (!pipelineLeadsTableActive()) return null

  const summary = await loadPipelineSummaryFast(user, metaStore, { filters })
  if (!summary) return null

  const scope = resolvePipelineTableScope(user, metaStore, filters)
  const statusFilter = String(filters.status || 'all').trim()
  const columnTotals = columnTotalsFromSummary(summary)
  const statusesToLoad =
    statusFilter !== 'all' && CRM_STATUSES.includes(statusFilter) ? [statusFilter] : CRM_STATUSES

  const columns = Object.fromEntries(CRM_STATUSES.map((s) => [s, []]))

  await Promise.all(
    statusesToLoad.map(async (status) => {
      const max =
        Number(columnLimits[status]) > 0 ? Number(columnLimits[status]) : defaultPerColumn
      const entries = await readPipelineLeadsScopedPage(
        shardName,
        scope,
        { offset: 0, limit: max, status, ...filters },
        user,
        metaStore
      )
      const visible = visiblePipelineFromEntries(metaStore, user, entries || [])
      const filtered = filterPipelineEntries(visible, filters)
      const sorted = filtered
        .slice()
        .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
      columns[status] = sorted.slice(0, max)
    })
  )

  const total =
    (await resolveListTotalFromIndex(user, metaStore, shardName, filters)) ?? summary.total ?? 0

  return {
    columns,
    totals: columnTotals,
    total,
    visibleTotal: summary.total ?? 0,
    fromTable: true,
  }
}

/**
 * Deals view — paginated flatten from scoped table pages (avoids full-org download).
 */
export async function loadPipelineDealsPage(
  user,
  {
    filters = {},
    dealStage = 'all',
    offset = 0,
    limit = 100,
    freightOrg = false,
  } = {}
) {
  const metaStore = await readStore({ only: META_STORE_COLLECTIONS })
  const shardName = pipelineShardNameForUser(user)
  const { readPipelineLeadsScopedPage, readPipelineLeadsForUser, pipelineLeadsTableActive } =
    await import('./pipelineLeadsTable.js')

  if (!pipelineLeadsTableActive()) return null

  const off = Math.max(0, Math.floor(Number(offset) || 0))
  const lim = Math.min(500, Math.max(1, Math.floor(Number(limit) || 100)))
  const stage = String(dealStage || 'all').trim() || 'all'
  const flattenOpts = {
    dealStage: stage === 'all' ? null : stage,
    includeClosed: stage === 'won' || stage === 'lost',
    freightOrg,
  }

  if (hasHeavyPipelineListFilters(filters)) {
    const entries = await readPipelineLeadsForUser(user, metaStore, shardName, filters)
    if (!entries) return null
    const visible = visiblePipelineFromEntries(metaStore, user, entries)
    const filtered = filterPipelineEntries(visible, filters)
    const rows = flattenDealsFromEntries(filtered, flattenOpts)
    const page = rows.slice(off, off + lim)
    return {
      deals: page,
      total: rows.length,
      limit: lim,
      offset: off,
      hasMore: off + page.length < rows.length,
      dealStage: stage,
      fromTable: true,
    }
  }

  const scope = await resolvePipelineTableScopeAsync(user, metaStore, filters)
  const dealFilters = { ...filters, hasDeals: true }
  const PAGE_SIZE = 150
  const MAX_LEADS_SCAN = 4000
  let leadOffset = 0
  let allRows = []

  while (leadOffset < MAX_LEADS_SCAN) {
    const entries = await readPipelineLeadsScopedPage(
      shardName,
      scope,
      {
        offset: leadOffset,
        limit: PAGE_SIZE,
        status: String(filters.status || 'all').trim(),
        ...dealFilters,
      },
      user,
      metaStore
    )
    if (!entries?.length) break

    const visible = visiblePipelineFromEntries(metaStore, user, entries)
    const filtered = filterPipelineEntries(visible, filters)
    allRows = allRows.concat(flattenDealsFromEntries(filtered, flattenOpts))

    leadOffset += entries.length
    if (entries.length < PAGE_SIZE) break
  }

  allRows.sort(
    (a, b) =>
      new Date(b.deal?.updatedAt || b.deal?.createdAt || 0) -
      new Date(a.deal?.updatedAt || a.deal?.createdAt || 0)
  )

  const page = allRows.slice(off, off + lim)

  return {
    deals: page,
    total: allRows.length,
    limit: lim,
    offset: off,
    hasMore: off + page.length < allRows.length || leadOffset >= MAX_LEADS_SCAN,
    dealStage: stage,
    fromTable: true,
    dealsScanCapped: leadOffset >= MAX_LEADS_SCAN,
  }
}

/** Summary with deal counts from index when freight org (no full pipeline scan). */
export async function loadPipelineSummaryWithDeals(user, { freightOrg = false } = {}) {
  const metaStore = await readStore({ only: META_STORE_COLLECTIONS })
  const shardName = pipelineShardNameForUser(user)
  const summary = await loadPipelineSummaryFast(user, metaStore)
  if (!summary) return null

  const payload = { ...summary, ready: true }
  if (freightOrg) {
    const doc = await readPipelineIndexDoc(shardName)
    if (doc?.openDealCounts) payload.openDealCounts = doc.openDealCounts
    if (doc?.dealCounts) payload.dealCounts = doc.dealCounts
  }

  const enriched = await attachPipelineIndexLocationFacets(payload, user, metaStore)
  return enriched
}

const MAX_PIPELINE_LEADS_BY_IDS = 500

/** Fetch specific pipeline rows by lead_id (marketing campaign slices, dashboard drill-downs). */
export async function loadPipelineLeadsByIds(user, leadIds, { light = true } = {}) {
  const ids = [...new Set((leadIds || []).filter(Boolean))].slice(0, MAX_PIPELINE_LEADS_BY_IDS)
  if (!ids.length) {
    return {
      leads: [],
      total: 0,
      filtered_total: 0,
      limit: 0,
      offset: 0,
      hasMore: false,
      pipelineTotal: 0,
      fromTable: true,
    }
  }

  const metaStore = await readStore({ only: META_STORE_COLLECTIONS })
  const shardName = pipelineShardNameForUser(user)
  const { pipelineLeadsTableActive, readPipelineLeadsByIds } = await import('./pipelineLeadsTable.js')

  let entries = []
  if (pipelineLeadsTableActive()) {
    entries = (await readPipelineLeadsByIds(shardName, ids)) || []
  } else {
    const { visible } = await loadPipelineStoreContext(user, { shardOnly: true })
    const idSet = new Set(ids)
    entries = visible.filter((entry) => {
      const lid = entry?.lead?.id || entry?.id
      return lid && idSet.has(lid)
    })
  }

  const visible = visiblePipelineFromEntries(metaStore, user, entries)
  const pipelineStore = attachPipelineEntriesToStore(metaStore, visible)
  const { leads } = listPipelinePage(pipelineStore, user, {
    light,
    limit: ids.length,
    offset: 0,
    entries: visible,
  })

  return {
    leads,
    total: leads.length,
    filtered_total: leads.length,
    limit: ids.length,
    offset: 0,
    hasMore: false,
    pipelineTotal: leads.length,
    fromTable: true,
  }
}
