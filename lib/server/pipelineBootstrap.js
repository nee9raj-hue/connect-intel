import { DEFAULT_PIPELINE_PAGE_SIZE } from './pipelineStore.js'
import { loadPipelineListPage } from './pipelineListLoad.js'
import { loadPipelineStoreContext, pipelineShardNameForUser } from './pipelineShard.js'
import {
  attachPipelineIndexLocationFacets,
  ensurePipelineIndex,
  loadPipelineSummaryFast,
  readPipelineIndexDoc,
} from './pipelineIndex.js'
import { readStore } from './store.js'

const META_COLLECTIONS = ['users', 'organizations', 'organizationMemberships']

/** SQL status counts omit location facets — build index once when missing. */
async function ensurePipelineLocationFacets(summary, user, metaStore) {
  if (!summary || (summary.total || 0) <= 0) return summary

  let result = await attachPipelineIndexLocationFacets(summary, user, metaStore)
  if (result.cities?.length || result.states?.length) return result

  const shardName = pipelineShardNameForUser(user)
  const doc = await readPipelineIndexDoc(shardName)
  if (doc?.cities?.length || doc?.states?.length) {
    return attachPipelineIndexLocationFacets(result, user, metaStore)
  }

  const { pipelineStore, visible, shardName: sn } = await loadPipelineStoreContext(user, {
    shardOnly: true,
  })
  return ensurePipelineIndex(sn, visible, user, pipelineStore)
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

  const metaStore = await readStore({ only: META_COLLECTIONS })
  let summary = await loadPipelineSummaryFast(user, metaStore, { filters })
  summary = await ensurePipelineLocationFacets(summary, user, metaStore)

  if (query.summaryOnly) {
    if (!summary) {
      const { pipelineStore, visible, shardName } = await loadPipelineStoreContext(user, {
        shardOnly: true,
      })
      summary = await ensurePipelineIndex(shardName, visible, user, pipelineStore)
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
    const { pipelineStore, visible, shardName } = await loadPipelineStoreContext(user, {
      shardOnly: true,
    })
    summary = await ensurePipelineIndex(shardName, visible, user, pipelineStore)
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
  const metaStore = await readStore({ only: META_COLLECTIONS })
  const scopedStore = { ...metaStore, savedLeads: [] }
  let summary = await loadPipelineSummaryFast(user, scopedStore)
  if (summary) {
    return ensurePipelineLocationFacets(summary, user, metaStore)
  }

  const shardName = pipelineShardNameForUser(user)
  const { pipelineStore, visible } = await loadPipelineStoreContext(user, { shardOnly: true })
  return ensurePipelineIndex(shardName, visible, user, pipelineStore)
}
