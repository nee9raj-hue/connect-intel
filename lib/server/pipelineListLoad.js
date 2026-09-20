import { CRM_STATUSES, isCrmLeadStatusFilter } from './crm.js'
import { boardBucketForLeadStatus, freightBoardColumnIds } from '../crmPipelineFlow.js'
import { isFreightDealOrg } from '../freightDeal.js'
import { flattenDealsFromEntries, dealStageIncludesClosed } from '../dealPipeline.js'
import { listPipelinePage, listPipelineSavedEntries } from './organizations.js'
import { filterPipelineEntries } from './pipelineQuery.js'
import {
  applyPipelineSummaryForUser,
  attachPipelineIndexLocationFacets,
  loadPipelineSummaryFast,
  readPipelineIndexDoc,
} from './pipelineIndex.js'
import {
  attachPipelineEntriesToStore,
  loadPipelineStoreContext,
  META_STORE_COLLECTIONS,
  pipelineMetaStoreFromSessionUser,
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
import { filtersUseDenormalizedSql, filtersUseEntryLocationFilter, filtersUseTagSql, filtersUseTeamSql, stripLocationSqlFilters } from './pipelineFilterSql.js'
import { supabaseRest } from './supabaseClient.js'
import { withExpandedAssigneeFilter } from '../pipelineActorIds.js'

export { resolvePipelineTableScope, resolvePipelineTableScopeAsync } from './pipelineTableScope.js'
export { getScopedLeadsQuery } from './pipelineScopedQuery.js'

const pipelineTableHealAt = new Map()
const PIPELINE_TABLE_HEAL_COOLDOWN_MS = 10 * 60 * 1000

function isCompanyPipeline(user) {
  return Boolean(user?.organizationId && user.accountType === 'company')
}

async function loadPipelineMetaStore(user) {
  if (isCompanyPipeline(user)) return pipelineMetaStoreFromSessionUser(user)
  return readStore({ only: META_STORE_COLLECTIONS })
}

async function maybeAutoHealPipelineLeadsTable(user, filters, { leadsLength, total }) {
  const orgId = user?.organizationId
  if (!orgId) return false
  const status = String(filters?.status || 'all').trim()
  if (!status || status === 'all' || !isCrmLeadStatusFilter(status)) return false
  if (leadsLength > 0 || !total) return false

  const last = pipelineTableHealAt.get(orgId) || 0
  if (Date.now() - last < PIPELINE_TABLE_HEAL_COOLDOWN_MS) return false

  const { verifyPipelineLeadsBackfill, backfillOrganization } = await import('./pipelineLeadsBackfill.js')
  const verify = await verifyPipelineLeadsBackfill({ orgId })
  if (verify.ok) return false

  pipelineTableHealAt.set(orgId, Date.now())
  await backfillOrganization(orgId, { batchSize: 100 })
  return true
}

/** Spread list/board filters first so explicit query fields (e.g. per-column status) win. */
export function mergePipelineQueryOptions(filters = {}, overrides = {}) {
  return { ...filters, ...overrides }
}

/** Filters that require scanning all rows (shard or full table walk). */
export function hasHeavyPipelineListFilters(filters = {}) {
  return Boolean(String(filters.q || '').trim() || filters.stuck)
}

/** True when the only “heavy” filter is text search (Meili can handle). */
export function isMeiliSearchOnlyFilters(filters = {}) {
  const q = String(filters.q || '').trim()
  if (!q) return false
  return !hasHeavyPipelineListFilters({ ...filters, q: '' })
}

export async function resolveListTotalFromIndex(user, metaStore, shardName, filters = {}) {
  const status = String(filters.status || 'all').trim()
  const assignee = String(filters.assigneeUserId || '').trim()
  const hasStatusFilter = status && status !== 'all' && isCrmLeadStatusFilter(status)

  if (filtersUseEntryLocationFilter(filters)) {
    const locationTotal = await countEntryLocationFilteredLeads(user, metaStore, filters)
    if (locationTotal != null) return locationTotal
  }

  if (filtersUseDenormalizedSql(filters) || isCompanyPipeline(user)) {
    const sqlTotal = await countScopedPipelineLeads(user, metaStore, filters)
    if (sqlTotal != null) return sqlTotal
    if (isCompanyPipeline(user)) return null
  }

  const doc = await readPipelineIndexDoc(shardName)

  if (doc) {
    if (assignee && assignee !== '__unassigned__') {
      const bucket = doc.byAssignee?.[assignee]
      if (!bucket) return 0
      if (hasStatusFilter) {
        return bucket.byStatus?.find((row) => row.status === status)?.count ?? 0
      }
      return bucket.total ?? 0
    }

    if (assignee !== '__unassigned__') {
      const summary = applyPipelineSummaryForUser(doc, user, metaStore)
      if (summary) {
        if (hasStatusFilter) {
          return summary.byStatus?.find((row) => row.status === status)?.count ?? 0
        }
        return summary.total ?? 0
      }
    }
  }

  if (isPipelineHierarchyRbacEnabled()) {
    const sqlTotal = await countScopedPipelineLeads(user, metaStore, filters)
    if (sqlTotal != null) return sqlTotal
  }

  if (!doc) return null

  if (assignee && assignee !== '__unassigned__') {
    const bucket = doc.byAssignee?.[assignee]
    if (!bucket) return 0
    if (hasStatusFilter) {
      return bucket.byStatus?.find((row) => row.status === status)?.count ?? 0
    }
    return bucket.total ?? 0
  }

  if (assignee === '__unassigned__') return null

  const summary = applyPipelineSummaryForUser(doc, user, metaStore)
  if (!summary) return null

  if (hasStatusFilter) {
    return summary.byStatus?.find((row) => row.status === status)?.count ?? 0
  }

  return summary.total ?? 0
}

function columnTotalsFromSummary(summary, columnIds = CRM_STATUSES) {
  const totals = Object.fromEntries(columnIds.map((s) => [s, 0]))
  for (const row of summary?.byStatus || []) {
    const bucket = boardBucketForLeadStatus(row.status, columnIds)
    if (totals[bucket] != null) totals[bucket] += row.count || 0
  }
  return totals
}

async function classifyAndPersistErpStages() {
  /* List/read paths must not write. Stage classify runs via scheduleErpPipelineMaintenance. */
}

async function entriesFromSqlRows(metaStore, user, sqlRows) {
  const entries = sqlRows.map((r) => r.entry).filter(Boolean)
  await classifyAndPersistErpStages(entries)
  const pipelineStore = attachPipelineEntriesToStore(metaStore, entries)
  const visibleOwnerIds = await resolveManagerVisibleOwnerIds(user, metaStore)
  const visible = listPipelineSavedEntries(pipelineStore, user, {
    visibleOwnerIds,
    trustedOrgScope: true,
  })
  return { pipelineStore, visible }
}

/** Count leads matching city/state on entry JSON (denormalized SQL columns are often stale). */
export async function countEntryLocationFilteredLeads(user, metaStore, filters = {}) {
  if (!filtersUseEntryLocationFilter(filters)) return null

  const sqlFilters = stripLocationSqlFilters(filters)
  let total = 0
  let nextCursor = null
  let attempts = 0
  const batchSize = 500
  const maxAttempts = 40

  while (attempts < maxAttempts) {
    const scoped = await getScopedLeadsQuery(
      user,
      { ...sqlFilters, offset: 0, limit: batchSize, cursor: nextCursor },
      metaStore
    )
    const rows = await supabaseRest(
      scopedLeadsListUrl(scoped),
      {},
      { timeoutMs: 8_000, attempts: 2, bypassCircuit: true }
    )
    if (!Array.isArray(rows) || !rows.length) break

    const { visible } = await entriesFromSqlRows(metaStore, user, rows)
    total += filterPipelineEntries(visible, filters).length

    nextCursor = buildNextPipelineCursor(rows, batchSize)
    if (!nextCursor) break
    attempts++
  }

  return total
}

/** Fetch a page when city/state filters apply — scan SQL batches and filter on entry JSON. */
async function fetchEntryLocationFilteredPage(user, metaStore, filters, { limit, light, cursor = null }) {
  const sqlFilters = stripLocationSqlFilters(filters)
  const lim = Math.max(1, Math.floor(Number(limit) || 50))
  const batchSize = Math.min(500, Math.max(lim * 4, 200))
  let collected = []
  let nextCursor = cursor || null
  let pipelineStore = attachPipelineEntriesToStore(metaStore, [])
  let attempts = 0
  const maxAttempts = 25

  while (collected.length < lim && attempts < maxAttempts) {
    const scoped = await getScopedLeadsQuery(
      user,
      { ...sqlFilters, offset: 0, limit: batchSize, cursor: nextCursor },
      metaStore
    )
    const rows = await supabaseRest(
      scopedLeadsListUrl(scoped),
      {},
      { timeoutMs: 8_000, attempts: 2, bypassCircuit: true }
    )
    if (!Array.isArray(rows) || !rows.length) {
      nextCursor = null
      break
    }

    const built = await entriesFromSqlRows(metaStore, user, rows)
    pipelineStore = built.pipelineStore
    collected.push(...filterPipelineEntries(built.visible, filters))

    nextCursor = buildNextPipelineCursor(rows, batchSize)
    if (!nextCursor) break
    attempts++
  }

  const pageEntries = collected.slice(0, lim)
  const { leads } = listPipelinePage(pipelineStore, user, {
    light,
    limit: lim,
    offset: 0,
    entries: pageEntries,
  })

  return {
    leads,
    pageEntries,
    pipelineStore,
    nextCursor: pageEntries.length >= lim ? nextCursor : null,
  }
}

async function loadPipelineListFromShard(user, { offset, limit, filters, light }) {
  const { pipelineStore, visible, shardName } = await loadPipelineStoreContext(user, {
    shardOnly: true,
  })
  const expanded = withExpandedAssigneeFilter(filters, pipelineStore, user.organizationId)
  const filtered = filterPipelineEntries(visible, expanded)
  const pageSlice = filtered.slice(offset, offset + limit)
  await classifyAndPersistErpStages(pageSlice, shardName)
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
  { offset = 0, limit = 50, filters: incomingFilters = {}, light = true, cursor = null } = {}
) {
  const { pipelineLeadsTableActive } = await import('./pipelineLeadsTable.js')
  if (!pipelineLeadsTableActive() || !isPipelineHierarchyRbacEnabled()) return null
  if (hasHeavyPipelineListFilters(incomingFilters)) return null

  const metaStore = await loadPipelineMetaStore(user)
  const filters = withExpandedAssigneeFilter(incomingFilters, metaStore, user.organizationId)
  const off = cursor ? 0 : Math.max(0, Math.floor(Number(offset) || 0))
  const lim = Math.max(1, Math.floor(Number(limit) || 50))
  let shardName = pipelineShardNameForUser(user)

  if (filtersUseEntryLocationFilter(filters)) {
    const [page, total] = await Promise.all([
      fetchEntryLocationFilteredPage(user, metaStore, filters, {
        limit: lim,
        light,
        cursor: cursor || filters.cursor,
      }),
      resolveListTotalFromIndex(user, metaStore, shardName, filters),
    ])

    const resolvedTotal = total != null ? total : page.leads.length
    return {
      pipelineStore: page.pipelineStore,
      visible: page.pageEntries,
      leads: page.leads,
      total: resolvedTotal,
      limit: lim,
      offset: off,
      hasMore: Boolean(page.nextCursor) || page.leads.length < resolvedTotal,
      nextCursor: page.nextCursor,
      pipelineTotal: resolvedTotal,
      fromTable: true,
      fromSqlScope: true,
      scopeRole: null,
      shardName,
    }
  }

  const scoped = await getScopedLeadsQuery(
    user,
    { ...filters, offset: off, limit: lim, cursor: cursor || filters.cursor },
    metaStore
  )
  shardName = scoped.shardName

  const [rows, indexTotal] = await Promise.all([
    supabaseRest(scopedLeadsListUrl(scoped), {}, { timeoutMs: 8_000, attempts: 1, bypassCircuit: true }).catch((err) => {
      console.warn('pipeline_leads page:', err?.message || err)
      return null
    }),
    resolveListTotalFromIndex(user, metaStore, shardName, filters),
  ])

  if (!Array.isArray(rows)) return null

  let total = indexTotal
  if (filtersUseTagSql(filters) || filtersUseDenormalizedSql(filters) || filtersUseTeamSql(filters)) {
    const exactTotal = await countScopedPipelineLeads(user, metaStore, filters)
    if (exactTotal != null) total = exactTotal
  }

  const buildFromRows = async (sqlRows) => {
    const nextCursor = buildNextPipelineCursor(sqlRows, scoped.pagination.limit)
    const entries = sqlRows.map((r) => r.entry).filter(Boolean)
    await classifyAndPersistErpStages(entries, shardName)
    const pipelineStore = attachPipelineEntriesToStore(metaStore, entries)
    const visibleOwnerIds = await resolveManagerVisibleOwnerIds(user, metaStore)
    const skipOwnerFilter = scoped.scope?.repSharedMode === 'team' || scoped.scope?.repSharedMode === 'tags'
    const listFilters = { ...filters, ...(scoped.scope?.listFilters || {}) }
    const visible = listPipelineSavedEntries(pipelineStore, user, {
      visibleOwnerIds,
      skipOwnerFilter,
      trustedOrgScope: true,
    })
    const pageEntries = filterPipelineEntries(visible, listFilters)
    const { leads } = listPipelinePage(pipelineStore, user, {
      light,
      limit: scoped.pagination.limit,
      offset: 0,
      entries: pageEntries,
    })
    return { nextCursor, pipelineStore, pageEntries, leads }
  }

  let { nextCursor, pipelineStore, pageEntries, leads } = await buildFromRows(rows)

  if (!leads.length && (total == null || total > 0)) {
    const healed = await maybeAutoHealPipelineLeadsTable(user, filters, {
      leadsLength: leads.length,
      total: total ?? 0,
    })
    if (healed) {
      const retryRows = await supabaseRest(
        scopedLeadsListUrl(scoped),
        {},
        { timeoutMs: 8_000, attempts: 2, bypassCircuit: true }
      )
      if (Array.isArray(retryRows)) {
        ;({ nextCursor, pipelineStore, pageEntries, leads } = await buildFromRows(retryRows))
        total = await resolveListTotalFromIndex(user, metaStore, shardName, filters)
      }
    }
  }

  if (total == null) {
    total = await countScopedPipelineLeads(user, metaStore, filters)
  }
  if (total == null) total = leads.length

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
 * Load a paginated pipeline list page for specific lead IDs (search hits).
 */
async function loadPipelineListFromLeadIds(
  user,
  { offset = 0, limit = 50, filters = {}, light = true, leadIds = [], source = {} } = {}
) {
  const off = Math.max(0, Math.floor(Number(offset) || 0))
  const lim = Math.max(1, Math.floor(Number(limit) || 50))
  const shardName = pipelineShardNameForUser(user)
  const metaStore = await loadPipelineMetaStore(user)

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
      shardName,
      ...source,
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

  const orderMap = new Map(leadIds.map((id, index) => [String(id), index]))
  visible.sort(
    (a, b) =>
      (orderMap.get(String(a.lead?.id)) ?? 999999) -
      (orderMap.get(String(b.lead?.id)) ?? 999999)
  )

  const filtered = filterPipelineEntries(visible, { ...filters, q: '' })
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
    fromTable: false,
    shardName,
    ...source,
  }
}

/** Same resolver as top CRM search — Meili when indexed, else SQL table search, else in-memory scan. */
async function loadPipelineListFromPlatformSearch(
  user,
  { offset = 0, limit = 50, filters = {}, light = true } = {}
) {
  if (!isMeiliSearchOnlyFilters(filters)) return null

  const metaStore = await loadPipelineMetaStore(user)
  const { searchPipelineLeadIdsViaTable } = await import('./pipelineTableSearch.js')
  const tableIds = await searchPipelineLeadIdsViaTable(user, metaStore, filters, { limit: 500 })
  if (tableIds !== null) {
    return loadPipelineListFromLeadIds(user, {
      offset,
      limit,
      filters,
      light,
      leadIds: tableIds,
      source: { fromTableSearch: true, searchProvider: 'pipeline_leads' },
    })
  }

  const { pipelineStore, visible } = await loadPipelineStoreContext(user, { shardOnly: true })
  const entries = pipelineStore.savedLeads?.length ? pipelineStore.savedLeads : visible
  const store = attachPipelineEntriesToStore(metaStore, entries)

  const { buildOrgUserResponse } = await import('./organizations.js')
  const { searchPlatformFast } = await import('./meilisearch/search.js')
  const clientUser = buildOrgUserResponse(store.users.find((u) => u.id === user.id) || user, store)
  const payload = await searchPlatformFast(store, clientUser, {
    q: filters.q,
    limit: 500,
  })

  const leadIds = []
  const seen = new Set()
  for (const row of payload.results || []) {
    const id = row.leadId || (row.type === 'lead' ? row.id : null)
    if (!id || seen.has(String(id))) continue
    seen.add(String(id))
    leadIds.push(String(id))
  }

  return loadPipelineListFromLeadIds(user, {
    offset,
    limit,
    filters,
    light,
    leadIds,
    source: { fromPlatformSearch: true, searchProvider: payload.provider || 'platform' },
  })
}

/**
 * Pipeline list search via Meilisearch → visible lead IDs → by-ID load (no full shard scan).
 */
async function loadPipelineListFromMeili(user, { offset = 0, limit = 50, filters = {}, light = true } = {}) {
  if (!isMeiliSearchOnlyFilters(filters)) return null

  const metaStore = await loadPipelineMetaStore(user)
  const { searchVisiblePipelineLeadIds } = await import('./meilisearch/pipelineListSearch.js')
  const leadIds = await searchVisiblePipelineLeadIds(user, metaStore, filters.q, {
    limit: 2000,
    assigneeUserId: filters.assigneeUserId,
  })
  if (leadIds === null) return null

  return loadPipelineListFromLeadIds(user, {
    offset,
    limit,
    filters,
    light,
    leadIds: leadIds || [],
    source: { fromMeili: true },
  })
}

async function companyListWithoutShard(user, metaStore, { offset, limit, filters, summary }) {
  const shardName = pipelineShardNameForUser(user)
  const total =
    summary?.total ??
    (await resolveListTotalFromIndex(user, metaStore, shardName, filters)) ??
    0
  return {
    pipelineStore: attachPipelineEntriesToStore(metaStore || {}, []),
    visible: [],
    leads: [],
    total,
    limit,
    offset,
    hasMore: total > 0,
    pipelineTotal: total,
    fromTable: true,
    fromSqlScope: true,
    shardName,
  }
}

/**
 * Paginated pipeline list — SQL scope fast path when enabled; table page + index totals otherwise.
 */
export async function loadPipelineListPage(
  user,
  { offset = 0, limit = 50, filters: incomingFilters = {}, light = true, cursor = null } = {}
) {
  const scopedView = await loadScopedLeadsListView(user, {
    offset,
    limit,
    filters: incomingFilters,
    light,
    cursor: cursor || incomingFilters.cursor,
  }).catch((err) => {
    console.warn('scoped pipeline list:', err?.message || err)
    return null
  })
  if (scopedView) return scopedView

  const off = Math.max(0, Math.floor(Number(offset) || 0))
  const lim = Math.max(1, Math.floor(Number(limit) || 50))

  if (isMeiliSearchOnlyFilters(incomingFilters)) {
    const meiliView = await loadPipelineListFromMeili(user, {
      offset: off,
      limit: lim,
      filters: incomingFilters,
      light,
    })
    if (meiliView) return meiliView

    const platformView = await loadPipelineListFromPlatformSearch(user, {
      offset: off,
      limit: lim,
      filters: incomingFilters,
      light,
    })
    if (platformView) return platformView
  }

  const metaStore = await loadPipelineMetaStore(user)
  const filters = withExpandedAssigneeFilter(incomingFilters, metaStore, user.organizationId)
  const shardName = pipelineShardNameForUser(user)

  const { pipelineLeadsTableActive, readPipelineLeadsScopedPage } = await import('./pipelineLeadsTable.js')

  if (!pipelineLeadsTableActive() || hasHeavyPipelineListFilters(filters)) {
    if (isCompanyPipeline(user)) {
      return companyListWithoutShard(user, metaStore, { offset: off, limit: lim, filters })
    }
    return loadPipelineListFromShard(user, { offset: off, limit: lim, filters, light })
  }

  const summary = await loadPipelineSummaryFast(user, metaStore, { filters, skipDealCounts: true })
  if (!summary) {
    if (isCompanyPipeline(user)) {
      return companyListWithoutShard(user, metaStore, { offset: off, limit: lim, filters })
    }
    return loadPipelineListFromShard(user, { offset: off, limit: lim, filters, light })
  }

  const scope = resolvePipelineTableScope(user, metaStore, filters)
  const status = String(filters.status || 'all').trim()
  const entries = await readPipelineLeadsScopedPage(
    shardName,
    scope,
    mergePipelineQueryOptions(filters, { offset: off, limit: lim, status }),
    user,
    metaStore
  )

  if (entries === null) {
    if (isCompanyPipeline(user)) {
      return companyListWithoutShard(user, metaStore, { offset: off, limit: lim, filters, summary })
    }
    return loadPipelineListFromShard(user, { offset: off, limit: lim, filters, light })
  }

  const { filterPipelineEntriesVisibleAsync } = await import('./pipelineVisibility.js')
  await classifyAndPersistErpStages(entries, shardName)
  const scopedEntries = await filterPipelineEntriesVisibleAsync(user, entries, metaStore)
  const pipelineStore = attachPipelineEntriesToStore(metaStore, scopedEntries)
  const visible = listPipelineSavedEntries(pipelineStore, user, { trustedOrgScope: true })
  const pageEntries = filterPipelineEntries(visible, filters)
  const { leads } = listPipelinePage(pipelineStore, user, {
    light,
    limit: lim,
    offset: 0,
    entries: pageEntries,
  })

  const total = await resolveListTotalFromIndex(user, metaStore, shardName, filters)
  if (total == null) {
    if (isCompanyPipeline(user)) {
      return {
        pipelineStore,
        visible: pageEntries,
        leads,
        total: summary.total ?? leads.length,
        limit: lim,
        offset: off,
        hasMore: off + leads.length < (summary.total ?? leads.length),
        pipelineTotal: summary.total ?? leads.length,
        fromTable: true,
        shardName,
      }
    }
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
  { filters: incomingFilters = {}, columnLimits = {}, defaultPerColumn = 50 } = {}
) {
  if (hasHeavyPipelineListFilters(incomingFilters)) return null
  if (String(incomingFilters.assigneeUserId || '').trim() === '__unassigned__') return null

  const metaStore = await loadPipelineMetaStore(user)
  const filters = withExpandedAssigneeFilter(incomingFilters, metaStore, user.organizationId)
  const shardName = pipelineShardNameForUser(user)
  const { pipelineLeadsTableActive, readPipelineLeadsScopedPage } = await import('./pipelineLeadsTable.js')
  if (!pipelineLeadsTableActive()) return null

  const summary = await loadPipelineSummaryFast(user, metaStore, { filters })
  if (!summary) return null

  const scope = await resolvePipelineTableScopeAsync(user, metaStore, filters)
  const boardColumnIds = isFreightDealOrg(user)
    ? freightBoardColumnIds({
        pipelineTrack: filters.pipelineTrack,
        status: filters.status,
      })
    : CRM_STATUSES
  const statusFilter = String(filters.status || 'all').trim()
  const columnTotals = columnTotalsFromSummary(summary, boardColumnIds)
  const statusesToLoad =
    statusFilter !== 'all' && isCrmLeadStatusFilter(statusFilter)
      ? [statusFilter]
      : boardColumnIds

  const columns = Object.fromEntries(boardColumnIds.map((s) => [s, []]))
  const loaded = []

  await Promise.all(
    statusesToLoad.map(async (status) => {
      const max =
        Number(columnLimits[status]) > 0 ? Number(columnLimits[status]) : defaultPerColumn
      const entries = await readPipelineLeadsScopedPage(
        shardName,
        scope,
        mergePipelineQueryOptions(filters, { offset: 0, limit: max, status }),
        user,
        metaStore
      )
      const skipOwnerFilter = scope.repSharedMode === 'team' || scope.repSharedMode === 'tags'
      const listFilters = { ...filters, ...(scope.listFilters || {}), status }
      const visible = visiblePipelineFromEntries(metaStore, user, entries || [], { skipOwnerFilter })
      const filtered = filterPipelineEntries(visible, listFilters)
      const sorted = filtered
        .slice()
        .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
      loaded.push(...sorted.slice(0, max))
    })
  )

  await classifyAndPersistErpStages(loaded, shardName)
  for (const entry of loaded) {
    const nextStatus = boardBucketForLeadStatus(entry?.crm?.status, boardColumnIds)
    if (columns[nextStatus]) columns[nextStatus].push(entry)
  }
  for (const status of boardColumnIds) {
    const max =
      Number(columnLimits[status]) > 0 ? Number(columnLimits[status]) : defaultPerColumn
    columns[status] = columns[status].slice(0, max)
  }

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
  const metaStore = await loadPipelineMetaStore(user)
  const { readPipelineLeadsScopedPage, readPipelineLeadsForUser, pipelineLeadsTableActive } =
    await import('./pipelineLeadsTable.js')
  const {
    listPipelineDealsPage,
    pipelineDealsTableActive,
  } = await import('./pipelineDealsTable.js')

  const off = Math.max(0, Math.floor(Number(offset) || 0))
  const lim = Math.min(120, Math.max(1, Math.floor(Number(limit) || 80)))
  const stage = String(dealStage || 'all').trim() || 'all'

  if (pipelineDealsTableActive() && user?.organizationId) {
    const sqlPage = await listPipelineDealsPage(user, {
      filters,
      dealStage: stage,
      offset: off,
      limit: lim,
      freightOrg,
      metaStore,
    })
    if (sqlPage) {
      return { ...sqlPage, fromTable: true }
    }
  }

  if (!pipelineLeadsTableActive()) return null
  const flattenOpts = {
    dealStage: stage === 'all' ? null : stage,
    includeClosed: dealStageIncludesClosed(stage),
    freightOrg,
  }

  const shardName = pipelineShardNameForUser(user)

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
  const PAGE_SIZE = 80
  const MAX_LEADS_SCAN = 480
  const needed = off + lim + 1
  let leadOffset = 0
  let allRows = []
  let scanExhausted = false

  while (leadOffset < MAX_LEADS_SCAN && allRows.length < needed) {
    const entries = await readPipelineLeadsScopedPage(
      shardName,
      scope,
      mergePipelineQueryOptions(dealFilters, {
        offset: leadOffset,
        limit: PAGE_SIZE,
        status: String(filters.status || 'all').trim(),
      }),
      user,
      metaStore
    )
    if (!entries?.length) {
      scanExhausted = true
      break
    }

    const visible = visiblePipelineFromEntries(metaStore, user, entries)
    const filtered = filterPipelineEntries(visible, filters)
    allRows = allRows.concat(flattenDealsFromEntries(filtered, flattenOpts))

    leadOffset += entries.length
    if (entries.length < PAGE_SIZE) {
      scanExhausted = true
      break
    }
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
    hasMore: off + page.length < allRows.length || !scanExhausted,
    dealStage: stage,
    fromTable: true,
    dealsScanCapped: !scanExhausted && leadOffset >= MAX_LEADS_SCAN,
  }
}

/** Summary with deal counts from index when freight org (no full pipeline scan). */
export async function loadPipelineSummaryWithDeals(user, { freightOrg = false } = {}) {
  const metaStore = await loadPipelineMetaStore(user)
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

  const metaStore = await loadPipelineMetaStore(user)
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
