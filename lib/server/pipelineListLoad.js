import { CRM_STATUSES } from './crm.js'
import { listPipelinePage, listPipelineSavedEntries, resolveOrgRole } from './organizations.js'
import { filterPipelineEntries } from './pipelineQuery.js'
import {
  applyPipelineSummaryForUser,
  loadPipelineSummaryFast,
  readPipelineIndexDoc,
} from './pipelineIndex.js'
import {
  attachPipelineEntriesToStore,
  loadPipelineStoreContext,
  META_STORE_COLLECTIONS,
  pipelineShardNameForUser,
} from './pipelineShard.js'
import { readStore } from './store.js'

/** Filters that require scanning all rows (shard or full table walk). */
export function hasHeavyPipelineListFilters(filters = {}) {
  return Boolean(
    String(filters.q || '').trim() ||
      (Array.isArray(filters.tagIds) && filters.tagIds.length) ||
      filters.city ||
      filters.state ||
      (Array.isArray(filters.cities) && filters.cities.length) ||
      (Array.isArray(filters.states) && filters.states.length) ||
      (filters.minLeadScore != null && filters.minLeadScore !== '') ||
      filters.followUpDue ||
      filters.overdueFollowUp
  )
}

export function resolvePipelineTableScope(user, metaStore, filters = {}) {
  const { orgRole, accountType } = resolveOrgRole(user, metaStore)
  const scope = {}

  if (accountType === 'individual' || !user.organizationId) {
    scope.userId = user.id
    return scope
  }

  scope.organizationId = user.organizationId

  if (orgRole === 'org_admin') {
    const assignee = String(filters.assigneeUserId || '').trim()
    if (assignee === '__unassigned__') scope.unassigned = true
    else if (assignee) scope.assigneeUserId = assignee
    return scope
  }

  scope.assigneeUserId = user.id
  return scope
}

async function resolveListTotalFromIndex(user, metaStore, shardName, filters = {}) {
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
 * Paginated pipeline list — table page + index totals when possible; full shard when filters need a scan.
 * Table is authoritative; shard is not written on this path.
 */
export async function loadPipelineListPage(user, { offset = 0, limit = 50, filters = {}, light = true } = {}) {
  const metaStore = await readStore({ only: META_STORE_COLLECTIONS })
  const shardName = pipelineShardNameForUser(user)
  const off = Math.max(0, Math.floor(Number(offset) || 0))
  const lim = Math.max(1, Math.floor(Number(limit) || 50))

  const { pipelineLeadsTableActive, readPipelineLeadsScopedPage } = await import('./pipelineLeadsTable.js')

  if (!pipelineLeadsTableActive() || hasHeavyPipelineListFilters(filters)) {
    return loadPipelineListFromShard(user, { offset: off, limit: lim, filters, light })
  }

  const summary = await loadPipelineSummaryFast(user, metaStore)
  if (!summary) {
    return loadPipelineListFromShard(user, { offset: off, limit: lim, filters, light })
  }

  const scope = resolvePipelineTableScope(user, metaStore, filters)
  const status = String(filters.status || 'all').trim()
  const entries = await readPipelineLeadsScopedPage(shardName, scope, {
    offset: off,
    limit: lim,
    status,
  })

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
