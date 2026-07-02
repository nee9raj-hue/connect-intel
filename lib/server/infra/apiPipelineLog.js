import { isPrometheusEnabled } from './config.js'
import { incCounter, observeHistogram } from './metrics.js'

function routeGroup(route = '') {
  const key = String(route || '')
  if (key.startsWith('crm/')) return 'crm'
  if (key.startsWith('marketing')) return 'marketing'
  return 'other'
}

/** Structured JSON log for Vercel log drain + optional Prometheus counters. */
export function logApiPipeline({
  route,
  durationMs,
  pipelineRowsRead = 0,
  pipelineSource = null,
  statusCode = null,
  loadCount = 0,
} = {}) {
  const payload = {
    event: 'api_pipeline',
    route: route || 'unknown',
    durationMs: Math.round(Number(durationMs) || 0),
    pipelineRows: pipelineRowsRead,
    pipelineRowsRead,
    pipelineSource: pipelineSource || 'none',
    loadCount,
    ...(statusCode != null ? { statusCode } : {}),
  }

  console.log(JSON.stringify(payload))

  if (!isPrometheusEnabled()) return payload

  const group = routeGroup(route)
  const status = statusCode != null && statusCode >= 400 ? 'error' : 'ok'

  observeHistogram(
    'connectintel_api_pipeline_duration_seconds',
    payload.durationMs / 1000,
    { route: payload.route, group }
  )
  if (pipelineRowsRead > 0) {
    observeHistogram('connectintel_pipeline_rows_read', pipelineRowsRead, {
      route: payload.route,
      source: pipelineSource || 'unknown',
      group,
    })
  }
  incCounter('connectintel_api_pipeline_total', { route: payload.route, group, status })
  return payload
}
