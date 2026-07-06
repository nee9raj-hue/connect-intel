import { applyCors, getBody, handleOptions, sendJson } from '../http.js'
import { parseSiteKey, parseUtmParams, recordSitePageView } from '../marketingSiteTracking.js'
import { readStore } from '../store.js'

const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')

async function resolveOrgOwner(organizationId) {
  const store = await readStore({ only: ['users', 'organizations'] })
  const admin = (store.users || []).find((u) => u.organizationId === organizationId && u.isOrgAdmin)
  return admin?.id || null
}

async function handleHit(query) {
  const key = String(query?.k || '').trim()
  const scope = parseSiteKey(key)
  if (!scope?.organizationId) return false

  const ownerId = await resolveOrgOwner(scope.organizationId)
  await recordSitePageView({
    organizationId: scope.organizationId,
    createdByUserId: ownerId,
    visitorId: query?.vid,
    url: query?.url,
    referrer: query?.ref || query?.referrer,
    utm: parseUtmParams(query),
  })
  return true
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method === 'GET') {
    const ok = await handleHit(req.query || {})
    res.statusCode = ok ? 200 : 400
    res.setHeader('Content-Type', 'image/gif')
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
    return res.end(PIXEL)
  }

  if (req.method === 'POST') {
    const body = getBody(req) || {}
    const ok = await handleHit({ ...req.query, ...body })
    if (!ok) return sendJson(res, 400, { error: 'invalid site key' })
    res.statusCode = 204
    return res.end()
  }

  res.statusCode = 405
  res.setHeader('Allow', 'GET, POST, OPTIONS')
  return res.end()
}
