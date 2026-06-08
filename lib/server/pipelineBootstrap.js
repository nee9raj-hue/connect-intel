import { DEFAULT_PIPELINE_PAGE_SIZE } from './pipelineStore.js'
import { listPipelinePage } from './organizations.js'
import { filterPipelineEntries } from './pipelineQuery.js'
import { loadPipelineStoreContext, pipelineShardNameForUser } from './pipelineShard.js'
import { ensurePipelineIndex, loadPipelineSummaryFast } from './pipelineIndex.js'
import { readStore } from './store.js'

const META_COLLECTIONS = ['users', 'organizations', 'organizationMemberships']

export async function buildPipelineBootstrap(user, query = {}) {
  const limit = Math.min(
    Math.max(1, Math.floor(Number(query.limit) || DEFAULT_PIPELINE_PAGE_SIZE)),
    500
  )
  const offset = Math.max(0, Math.floor(Number(query.offset) || 0))

  const filters = {
    status: String(query.status || 'all').trim(),
    q: String(query.q || '').trim(),
    assigneeUserId: String(query.assigneeUserId || '').trim() || null,
    tagIds: query.tagIds || [],
    city: query.city || '',
    state: query.state || '',
    cities: query.cities || [],
    states: query.states || [],
  }

  const { pipelineStore, visible, shardName } = await loadPipelineStoreContext(user, {
    shardOnly: true,
  })

  let summary = await loadPipelineSummaryFast(user, pipelineStore)
  if (!summary) {
    summary = await ensurePipelineIndex(shardName, visible, user, pipelineStore)
  }

  const filtered = filterPipelineEntries(visible, filters)
  const { leads, total } = listPipelinePage(pipelineStore, user, {
    light: true,
    limit,
    offset,
    entries: filtered,
  })

  return {
    summary,
    leads,
    total,
    limit,
    offset,
    hasMore: offset + leads.length < total,
    pipelineTotal: visible.length,
    ready: true,
  }
}

/** Summary only — no pipeline shard download. */
export async function loadPipelineSummaryOnly(user) {
  const metaStore = await readStore({ only: META_COLLECTIONS })
  const scopedStore = { ...metaStore, savedLeads: [] }
  const summary = await loadPipelineSummaryFast(user, scopedStore)
  if (summary) return summary

  const shardName = pipelineShardNameForUser(user)
  const { pipelineStore, visible } = await loadPipelineStoreContext(user, { shardOnly: true })
  return ensurePipelineIndex(shardName, visible, user, pipelineStore)
}
