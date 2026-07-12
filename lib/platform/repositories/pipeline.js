import { pipelineOrgShardName, readPipelineShardEntries } from '../../server/pipelineShard.js'
import { loadPipelineListPage } from '../../server/pipelineListLoad.js'

export function createPipelineRepository({ database }) {
  return {
    async readShardEntries(organizationId, options = {}) {
      const shardName = pipelineOrgShardName(organizationId)
      return readPipelineShardEntries(shardName, options)
    },

    /**
     * Pipeline list page — delegates to existing list loader (SQL + shard paths).
     * Handlers should migrate GET list reads here before mutating saved-leads.js writes.
     */
    async loadListPage(user, options = {}) {
      return loadPipelineListPage(user, options)
    },

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
