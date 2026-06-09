import { isPrometheusEnabled } from '../infra/config.js'
import { renderPrometheusMetrics } from '../infra/metrics.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  if (!isPrometheusEnabled()) {
    return sendJson(res, 404, { error: 'Metrics disabled. Set PROMETHEUS_METRICS=true to enable.' })
  }

  const secret = process.env.METRICS_SECRET || process.env.CRON_SECRET
  if (secret) {
    const auth = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '')
    const querySecret = req.query?.secret
    if (auth !== secret && querySecret !== secret) {
      return sendJson(res, 401, { error: 'Unauthorized' })
    }
  }

  const body = renderPrometheusMetrics()
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  res.end(body)
}
