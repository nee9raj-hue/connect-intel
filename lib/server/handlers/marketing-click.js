import { applyCors, handleOptions } from '../http.js'
import { parseTrackingToken } from '../marketingTracking.js'
import { recordMarketingEvent } from '../marketingEvents.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    res.statusCode = 405
    return res.end()
  }

  const payload = parseTrackingToken(req.query?.t)
  const target = String(req.query?.u || '').trim()

  if (payload?.campaignId) {
    await recordMarketingEvent({
      organizationId: payload.organizationId,
      createdByUserId: payload.createdByUserId,
      campaignId: payload.campaignId,
      enrollmentId: payload.enrollmentId,
      leadId: payload.leadId,
      type: 'click',
      url: target,
    })

    if (payload.leadId) {
      const { fireAutomationTrigger } = await import('../automationTriggers.js')
      await fireAutomationTrigger({
        type: 'link_clicked',
        leadId: payload.leadId,
        organizationId: payload.organizationId,
        createdByUserId: payload.createdByUserId,
        meta: { campaignId: payload.campaignId, url: target },
      }).catch(() => {})
    }
  }

  if (target && /^https?:\/\//i.test(target)) {
    res.statusCode = 302
    res.setHeader('Location', target)
    return res.end()
  }

  res.statusCode = 400
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  return res.end('Invalid link')
}
