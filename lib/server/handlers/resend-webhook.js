import crypto from 'node:crypto'
import { readStore, updateStore } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { recordSuppression } from '../marketingUnsubscribe.js'
import { bumpCampaignStatsShard } from '../marketingCampaignStatsShard.js'

function verifyResendSignature(rawBody, signature, secret) {
  if (!secret || !signature) return !secret
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    return signature === expected
  }
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])

  const secret = process.env.RESEND_WEBHOOK_SECRET
  const body = getBody(req)
  const type = body?.type || body?.event || ''
  const data = body?.data || body

  const email = String(data?.to?.[0] || data?.email || data?.recipient || '').trim().toLowerCase()
  const tags = data?.tags || {}
  const campaignId = tags.campaignId || tags.campaign_id || data?.campaignId || null
  const enrollmentId = tags.enrollmentId || tags.enrollment_id || null

  if (type.includes('bounce') || type.includes('complaint') || type.includes('delivery')) {
    const store = await readStore({
      only: ['marketingCampaigns', 'organizations', 'marketingSuppressions'],
    })

    let organizationId = null
    if (campaignId) {
      const campaign = (store.marketingCampaigns || []).find((c) => c.id === campaignId)
      organizationId = campaign?.organizationId || null
    }

    if (type.includes('bounce') || data?.bounce) {
      if (email && organizationId) {
        await recordSuppression({ organizationId, createdByUserId: null, email, reason: 'bounce' })
      }
      if (campaignId) {
        await bumpCampaignStatsShard(campaignId, { bounced: 1, failed: 1 })
      }
    }

    if (type.includes('complaint') || data?.complaint) {
      if (email && organizationId) {
        await recordSuppression({ organizationId, createdByUserId: null, email, reason: 'complaint' })
      }
      if (campaignId) {
        await bumpCampaignStatsShard(campaignId, { unsubscribed: 1 })
      }
    }

    if (type.includes('delivered') || type === 'email.delivered') {
      if (campaignId) {
        await bumpCampaignStatsShard(campaignId, { delivered: 1 })
      }
    }
  }

  return sendJson(res, 200, { ok: true, received: type || 'unknown' })
}
