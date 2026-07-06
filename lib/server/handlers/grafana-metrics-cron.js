import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { isPrometheusEnabled } from '../infra/config.js'
import {
  isGrafanaRemoteWriteConfigured,
  pushConnectIntelMetricsToGrafana,
} from '../grafanaRemoteWrite.js'

function isCronAuthorized(req, body) {
  if (req.headers['x-vercel-cron'] === '1') return true
  const secret = process.env.CRON_SECRET || process.env.MARKETING_CRON_SECRET
  if (!secret) return false
  const authHeader = req.headers?.authorization || ''
  const provided =
    authHeader.replace(/^Bearer\s+/i, '') || req.query?.secret || body?.secret
  return provided === secret
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'POST' && req.method !== 'GET') {
    return methodNotAllowed(res, ['GET', 'POST'])
  }

  const body = req.method === 'POST' ? getBody(req) : {}
  if (!isCronAuthorized(req, body)) {
    return sendJson(res, 401, { error: 'Unauthorized' })
  }

  if (!isPrometheusEnabled()) {
    return sendJson(res, 200, { ok: true, skipped: true, reason: 'metrics_disabled' })
  }

  if (!isGrafanaRemoteWriteConfigured()) {
    return sendJson(res, 200, { ok: true, skipped: true, reason: 'grafana_not_configured' })
  }

  try {
    const result = await pushConnectIntelMetricsToGrafana()
    if (!result.ok) {
      console.error('grafana metrics cron failed:', result.error || result.statusText)
      return sendJson(res, 502, { ok: false, ...result })
    }
    return sendJson(res, 200, { ok: true, series: result.series, status: result.status })
  } catch (err) {
    console.error('grafana metrics cron error:', err?.message || err)
    return sendJson(res, 500, { error: err.message || 'Grafana metrics push failed' })
  }
}
