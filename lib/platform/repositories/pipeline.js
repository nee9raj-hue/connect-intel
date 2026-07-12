import { pipelineOrgShardName, readPipelineShardEntries } from '../../server/pipelineShard.js'
import { loadPipelineSummaryOnly } from '../../server/pipelineBootstrap.js'
import {
  loadPipelineBoardView,
  loadPipelineDealsPage,
  loadPipelineLeadsByIds,
  loadPipelineListPage,
  loadPipelineSummaryWithDeals,
} from '../../server/pipelineListLoad.js'

/** Map list loader flags to client pipelineSource (saved-leads GET contract). */
export function resolvePipelineListSource(list = {}) {
  if (list.fromTableSearch) return 'pipeline_leads_search'
  if (list.fromPlatformSearch) return 'platform_search'
  if (list.fromMeili) return 'meilisearch'
  if (list.fromSqlScope) return 'pipeline_leads_scoped_sql'
  if (list.fromTable) return 'pipeline_leads_table'
  return 'shard'
}

export function createPipelineRepository({ database }) {
  return {
    async readShardEntries(organizationId, options = {}) {
      const shardName = pipelineOrgShardName(organizationId)
      return readPipelineShardEntries(shardName, options)
    },

    async loadListPage(user, options = {}) {
      return loadPipelineListPage(user, options)
    },

    async loadLeadsByIds(user, leadIds, options = {}) {
      return loadPipelineLeadsByIds(user, leadIds, options)
    },

    async loadSummaryOnly(user) {
      return loadPipelineSummaryOnly(user)
    },

    async loadBoardView(user, options = {}) {
      return loadPipelineBoardView(user, options)
    },

    async loadDealsPage(user, options = {}) {
      return loadPipelineDealsPage(user, options)
    },

    async loadSummaryWithDeals(user, options = {}) {
      return loadPipelineSummaryWithDeals(user, options)
    },

    resolveListSource: resolvePipelineListSource,

    async summaryForOrg(organizationId) {
      const entries = await this.readShardEntries(organizationId, { bypassCache: true })
      const byStatus = {}
      for (const entry of entries || []) {
        const status = entry?.crm?.status || 'new'
        byStatus[status] = (byStatus[status] || 0) + 1
      }
      return {
        organizationId,
        total: (entries || []).length,
        byStatus,
      }
    },

    async verifySqlBackfill(organizationId) {
      const { verifyPipelineLeadsBackfill } = await import('../../server/pipelineLeadsBackfill.js')
      return verifyPipelineLeadsBackfill({ orgId: organizationId || null })
    },
  }
}
