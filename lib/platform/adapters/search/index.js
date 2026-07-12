import { meiliEnabled, testMeilisearchConnection } from '../../../server/meilisearch/client.js'
import { warmAllMeilisearch } from '../../../server/meiliWarm.js'

export function createPostgresSearchAdapter() {
  return {
    provider: 'postgres',
    async searchLeads({ user, query, limit = 50 }) {
      const { loadPipelineListForUser } = await import('../../../server/pipelineListLoad.js')
      const result = await loadPipelineListForUser(user, {
        q: String(query || '').trim(),
        limit,
        offset: 0,
      })
      return { ok: true, hits: result.leads || [], provider: 'postgres' }
    },
    async ping() {
      return { ok: true }
    },
  }
}

export function createMeilisearchSearchAdapter() {
  return {
    provider: 'meilisearch',
    async searchLeads({ orgId, nameQuery } = {}) {
      const result = await warmAllMeilisearch({ orgId, nameQuery })
      return { ok: result.ok !== false, ...result, provider: 'meilisearch' }
    },
    async ping() {
      if (!meiliEnabled()) return { ok: false, error: 'not_configured' }
      return testMeilisearchConnection()
    },
  }
}

export function createSearchAdapter(provider) {
  switch (provider) {
    case 'meilisearch':
      return createMeilisearchSearchAdapter()
    case 'none':
      return {
        provider: 'none',
        async searchLeads() {
          return { ok: false, hits: [], error: 'search_disabled' }
        },
        async ping() {
          return { ok: false }
        },
      }
    case 'postgres':
    default:
      return createPostgresSearchAdapter()
  }
}
