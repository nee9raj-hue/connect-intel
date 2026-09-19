import { requireUser } from '../auth.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { buildPipelineBootstrap } from '../pipelineBootstrap.js'
import { cacheGet, cacheSet, getPipelineBootstrapGeneration, pipelineBootstrapCacheKey } from '../infra/cache.js'
import { timeAsync } from '../infra/metrics.js'
import { parsePipelineQueryParams } from '../pipelineQueryParams.js'
import { attachTeamMemberUserIdsToFilters } from '../orgTeamLeadTags.js'
import { customerSafeErrorMessage } from '../customerError.js'

const TTL = 45
const STALE = 120

async function parseBootstrapQuery(url, organizationId) {
  const parsed = parsePipelineQueryParams(url)
  const withTeams = await attachTeamMemberUserIdsToFilters(organizationId, parsed)
  const limit = url.searchParams.get('limit')
  const offset = url.searchParams.get('offset')
  const summaryOnly = url.searchParams.get('summaryOnly') === '1'
  return {
    ...withTeams,
    scope: String(url.searchParams.get('scope') || url.searchParams.get('hierarchyScope') || '').trim() || null,
    limit,
    offset,
    summaryOnly,
  }
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const user = await requireUser(req, res)
  if (!user) return

  try {
    const url = new URL(req.url || '', 'http://local')
    const query = await parseBootstrapQuery(url, user.organizationId)
    const fresh = url.searchParams.get('fresh') === '1'
    const generation = await getPipelineBootstrapGeneration(user)
    const cacheKey = pipelineBootstrapCacheKey(user, query, generation)
    const cached = fresh ? { value: null, stale: false } : await cacheGet(cacheKey, { ttlSeconds: TTL, staleSeconds: STALE })
    if (cached.value && !cached.stale) {
      return sendJson(res, 200, {
        ...cached.value,
        scopeRole: cached.value.summary?.scopeRole || null,
        _cache: { hit: true },
      })
    }

    const payload = await timeAsync('connectintel_pipeline_bootstrap', {}, () =>
      buildPipelineBootstrap(user, query)
    )
    const response = {
      ...payload,
      scopeRole: payload.summary?.scopeRole || null,
    }
    void cacheSet(cacheKey, response, { ttlSeconds: TTL })
    return sendJson(res, 200, { ...response, _cache: { hit: false, stale: cached.stale } })
  } catch (error) {
    console.error('pipeline/bootstrap failed:', error)
    return sendJson(res, 500, {
      error: customerSafeErrorMessage(error),
    })
  }
}
