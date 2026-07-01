import { applyCors, handleOptions, sendJson } from '../lib/server/http.js'
import { captureException } from '../lib/server/infra/sentry.js'
import { observeHistogram } from '../lib/server/infra/metrics.js'
import {
  getInfraStatus,
  isMarketingSqlQueueEnabled,
  isPipelineHierarchyRbacEnabled,
  isPipelineLeadsTableEnabled,
} from '../lib/server/infra/config.js'
import { API_ROUTES } from '../lib/server/apiRouteRegistry.js'

let prodSqlFlagsWarned = false

function warnProductionSqlFlags() {
  if (prodSqlFlagsWarned) return
  if (process.env.VERCEL_ENV !== 'production') return

  const disabled = []
  if (!isPipelineLeadsTableEnabled()) disabled.push('USE_PIPELINE_LEADS_TABLE')
  if (!isPipelineHierarchyRbacEnabled()) disabled.push('USE_PIPELINE_HIERARCHY_RBAC')
  if (!isMarketingSqlQueueEnabled()) disabled.push('USE_MARKETING_SQL_QUEUE')

  if (disabled.length) {
    const infra = getInfraStatus()
    console.warn(
      '[Connect Intel] Production SQL path disabled — enable Supabase env vars or set USE_* flags:',
      disabled.join(', '),
      infra
    )
  }
  prodSqlFlagsWarned = true
}

/** Marketing/bulk sends may process several Gmail API calls per request. */
export const config = {
  maxDuration: 300,
}

function resolvePath(req) {
  const fromQuery = req.query.path
  if (typeof fromQuery === 'string' && fromQuery) return fromQuery
  if (Array.isArray(fromQuery) && fromQuery.length) return fromQuery.join('/')

  const rawUrl = req.url || ''
  const pathname = rawUrl.split('?')[0]
  return pathname.replace(/^\/api\/?/, '').replace(/\/$/, '')
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)
  warnProductionSqlFlags()

  const pathKey = resolvePath(req)
  const started = performance.now()

  try {
    const load = API_ROUTES[pathKey]

    if (!load) {
      return sendJson(res, 404, { error: `Unknown API route: ${pathKey || '(empty)'}` })
    }

    const mod = await load()
    return await mod.default(req, res)
  } catch (error) {
    console.error(`API ${pathKey || '(empty)'} failed:`, error)
    void captureException(error, { route: pathKey || '(empty)' })
    return sendJson(res, 500, {
      error: error?.message || 'Server error',
      route: pathKey || null,
    })
  } finally {
    observeHistogram(
      'connectintel_api_request_duration_seconds',
      (performance.now() - started) / 1000,
      { route: pathKey || 'unknown' }
    )
  }
}
