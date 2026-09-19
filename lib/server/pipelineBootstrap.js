import { DEFAULT_PIPELINE_PAGE_SIZE } from './pipelineStore.js'
import { loadPipelineListPage } from './pipelineListLoad.js'
import { pipelineMetaStoreFromSessionUser, loadPipelineStoreContext, pipelineShardNameForUser } from './pipelineShard.js'
import {
  attachPipelineIndexLocationFacets,
  ensurePipelineIndex,
  loadPipelineSummaryFast,
  readPipelineIndexDoc,
} from './pipelineIndex.js'
import { readStore } from './store.js'

const META_COLLECTIONS = ['users', 'organizations', 'organizationMemberships']

/** SQL status counts omit location facets — attach them from the index when present. */
async function ensurePipelineLocationFacets(summary, user, metaStore) {
  if (!summary || (summary.total || 0) <= 0) return summary
  if (user?.organizationId && user?.accountType === 'company') return summary
  try {
    return await attachPipelineIndexLocationFacets(summary, user, metaStore)
  } catch (err) {
    console.warn('pipeline location facets:', err?.message || err)
    return summary
  }
}

export async function buildPipelineBootstrap(user, query = {}) {
  const minLeadScore = query.minLeadScore != null ? Number(query.minLeadScore) : null
  const filters = {
    status: String(query.status || 'all').trim(),
    q: String(query.q || '').trim(),
    assigneeUserId: String(query.assigneeUserId || '').trim() || null,
    tagIds: query.tagIds || [],
    city: query.city || '',
    state: query.state || '',
    cities: query.cities || [],
    states: query.states || [],
    minLeadScore: Number.isFinite(minLeadScore) ? minLeadScore : null,
    followUpDue: Boolean(query.followUpDue),
    overdueFollowUp: Boolean(query.overdueFollowUp),
    scope: String(query.scope || query.hierarchyScope || '').trim() || null,
  }

  const isCompany = Boolean(user?.organizationId && user?.accountType === 'company')
  const metaStore = isCompany
    ? pipelineMetaStoreFromSessionUser(user)
    : await readStore({ only: META_COLLECTIONS })
  let summary = await loadPipelineSummaryFast(user, metaStore, { filters, skipDealCounts: true })
  summary = await ensurePipelineLocationFacets(summary, user, metaStore)

  if (query.summaryOnly) {
    if (!summary) {
      if (isCompany) {
        summary = { total: 0, byStatus: [], cities: [], states: [] }
      } else {
        const { pipelineStore, visible, shardName } = await loadPipelineStoreContext(user, {
          shardOnly: true,
        })
        summary = await ensurePipelineIndex(shardName, visible, user, pipelineStore)
      }
    }
    return {
      summary,
      ready: true,
      summaryOnly: true,
      scopeRole: summary?.scopeRole || null,
    }
  }

  const limit = Math.min(
    Math.max(1, Math.floor(Number(query.limit) || DEFAULT_PIPELINE_PAGE_SIZE)),
    500
  )
  const offset = Math.max(0, Math.floor(Number(query.offset) || 0))
  const cursor = String(query.cursor || '').trim() || null

  const list = await loadPipelineListPage(user, {
    offset,
    limit,
    filters,
    light: true,
    cursor,
  })

  if (!summary) {
    if (!(user?.organizationId && user?.accountType === 'company')) {
      const { pipelineStore, visible, shardName } = await loadPipelineStoreContext(user, {
        shardOnly: true,
      })
      summary = await ensurePipelineIndex(shardName, visible, user, pipelineStore)
    } else {
      summary = {
        total: list.total || 0,
        byStatus: [],
        cities: [],
        states: [],
      }
    }
  }

  return {
    summary,
    leads: list.leads,
    total: list.total,
    limit: list.limit,
    offset: list.offset,
    hasMore: list.hasMore,
    nextCursor: list.nextCursor || null,
    pipelineTotal: list.pipelineTotal,
    ready: true,
    pipelineSource: list.fromSqlScope
      ? 'pipeline_leads_scoped_sql'
      : list.fromTable
        ? 'pipeline_leads_table'
        : 'shard',
    scopeRole: list.scopeRole || summary?.scopeRole || null,
  }
}

/** Summary only — no pipeline shard download. */
export async function loadPipelineSummaryOnly(user) {
  const isCompany = Boolean(user?.organizationId && user?.accountType === 'company')
  const metaStore = isCompany
    ? pipelineMetaStoreFromSessionUser(user)
    : await readStore({ only: META_COLLECTIONS })
  const scopedStore = { ...metaStore, savedLeads: [] }
  let summary = await loadPipelineSummaryFast(user, scopedStore, { skipDealCounts: true })
  if (summary) {
    return ensurePipelineLocationFacets(summary, user, metaStore)
  }

  if (user?.organizationId && user?.accountType === 'company') {
    return { total: 0, byStatus: [], cities: [], states: [], ready: true }
  }

  const shardName = pipelineShardNameForUser(user)
  const { pipelineStore, visible } = await loadPipelineStoreContext(user, { shardOnly: true })
  return ensurePipelineIndex(shardName, visible, user, pipelineStore)
}
