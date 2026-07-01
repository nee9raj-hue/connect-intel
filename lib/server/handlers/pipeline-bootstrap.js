import { requireUser } from '../auth.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { buildPipelineBootstrap } from '../pipelineBootstrap.js'
import { cacheGet, cacheSet, pipelineBootstrapCacheKey } from '../infra/cache.js'
import { timeAsync } from '../infra/metrics.js'

const TTL = 45
const STALE = 120

function parseBootstrapQuery(url) {
  const status = String(url.searchParams.get('status') || 'all').trim()
  const q = String(url.searchParams.get('q') || '').trim()
  const cities = url.searchParams.getAll('city').map((c) => String(c).trim()).filter(Boolean)
  const states = url.searchParams.getAll('state').map((s) => String(s).trim()).filter(Boolean)
  const assigneeUserId = String(url.searchParams.get('assigneeUserId') || '').trim() || null
  const tagIds = url.searchParams.getAll('tagId').filter(Boolean)
  const minLeadScore = url.searchParams.has('minLeadScore')
    ? Number(url.searchParams.get('minLeadScore'))
    : null
  const limit = url.searchParams.get('limit')
  const offset = url.searchParams.get('offset')
  const cursor = String(url.searchParams.get('cursor') || '').trim() || null
  const summaryOnly = url.searchParams.get('summaryOnly') === '1'

  return {
    status,
    q,
    cities,
    states,
    assigneeUserId,
    tagIds,
    minLeadScore: Number.isFinite(minLeadScore) ? minLeadScore : null,
    followUpDue: url.searchParams.get('followUpDue') === '1',
    overdueFollowUp: url.searchParams.get('overdueFollowUp') === '1',
    scope: String(url.searchParams.get('scope') || url.searchParams.get('hierarchyScope') || '').trim() || null,
    limit,
    offset,
    cursor,
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
    const query = parseBootstrapQuery(url)
    const cacheKey = pipelineBootstrapCacheKey(user, query)
    const cached = await cacheGet(cacheKey, { ttlSeconds: TTL, staleSeconds: STALE })
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
      error: error.message || 'Could not load pipeline workspace',
    })
  }
}
