import { readStore, updateStore } from '../store.js'
import { applyCors, handleOptions, sendJson } from '../http.js'
import { ingestWhatsAppWebhook } from '../whatsappInbox.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const verifyToken = String(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '').trim()
  const url = new URL(req.url || '', 'http://local')

  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')
    if (mode === 'subscribe' && verifyToken && token === verifyToken && challenge) {
      res.statusCode = 200
      res.setHeader('Content-Type', 'text/plain')
      res.end(challenge)
      return
    }
    return sendJson(res, 403, { error: 'Verification failed' })
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed' })
  }

  let body = req.body
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      body = {}
    }
  }

  const entries = body?.entry || []
  let total = 0

  await updateStore((draft) => {
    for (const entry of entries) {
      for (const change of entry?.changes || []) {
        const phoneNumberId = change?.value?.metadata?.phone_number_id
        if (!phoneNumberId) continue
        const result = ingestWhatsAppWebhook(draft, phoneNumberId, { entry: [entry] })
        total += result.processed || 0
      }
    }
    return draft
  })

  return sendJson(res, 200, { ok: true, processed: total })
}
