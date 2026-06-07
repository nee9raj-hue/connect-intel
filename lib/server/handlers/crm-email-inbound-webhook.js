import { applyCors, handleOptions, sendJson } from '../http.js'
import { ingestCrmInboundEmailEvent, isCrmInboundEmailEnabled } from '../crmInboundEmail.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method === 'GET') {
    return sendJson(res, 200, {
      ok: true,
      endpoint: 'crm-email-inbound',
      accepts: 'POST',
      event: 'email.received',
      configured: isCrmInboundEmailEnabled(),
      hint: 'Configure this URL in Resend → Webhooks (POST only). Opening in a browser is a health check.',
    })
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed' })
  }

  if (!isCrmInboundEmailEnabled()) {
    return sendJson(res, 503, { error: 'CRM inbound email is not configured' })
  }

  let body = req.body
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      body = {}
    }
  }

  const type = body?.type
  if (type !== 'email.received') {
    return sendJson(res, 200, { ok: true, ignored: type || 'unknown' })
  }

  try {
    const result = await ingestCrmInboundEmailEvent(body.data || {})
    return sendJson(res, 200, result)
  } catch (error) {
    console.error('CRM inbound email webhook failed:', error)
    return sendJson(res, 500, { error: error.message || 'Inbound processing failed' })
  }
}
