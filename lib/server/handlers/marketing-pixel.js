import { applyCors, handleOptions, sendJson } from '../http.js'
import { buildSitePixelJs, parseSiteKey } from '../marketingSiteTracking.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'GET') {
    res.statusCode = 405
    res.setHeader('Allow', 'GET, OPTIONS')
    return res.end()
  }

  const key = String(req.query?.k || '').trim()
  const scope = parseSiteKey(key)
  if (!scope?.organizationId) {
    res.statusCode = 400
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    return res.end('Invalid site key')
  }

  const js = buildSitePixelJs(key)
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=3600')
  return res.end(js)
}
