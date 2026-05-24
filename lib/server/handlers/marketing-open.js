import { applyCors, handleOptions } from '../http.js'
import { parseTrackingToken } from '../marketingTracking.js'
import { recordMarketingEvent } from '../marketingEvents.js'

const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    res.statusCode = 405
    return res.end()
  }

  const payload = parseTrackingToken(req.query?.t)
  if (!payload?.campaignId) {
    res.statusCode = 400
    res.setHeader('Content-Type', 'image/gif')
    return res.end(PIXEL)
  }

  await recordMarketingEvent({
    organizationId: payload.organizationId,
    createdByUserId: payload.createdByUserId,
    campaignId: payload.campaignId,
    enrollmentId: payload.enrollmentId,
    leadId: payload.leadId,
    type: 'open',
  })

  res.statusCode = 200
  res.setHeader('Content-Type', 'image/gif')
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
  return res.end(PIXEL)
}
