import crypto from 'node:crypto'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { incrementMarketingAnalyticsSnapshot } from '../marketingAnalyticsSnapshots.js'
import { patchMarketingQueueRow } from '../marketingEmailQueue.js'
import { isSupabaseEnabled, supabaseRest } from '../supabaseClient.js'
import { patchPipelineLeadsTable } from '../pipelineLeadsTable.js'

const QUEUE_TABLE = 'marketing_email_queue'

function verifyWebhookSecret(req, body) {
  const expected = process.env.MARKETING_WEBHOOK_SECRET || process.env.CRON_SECRET
  if (!expected) return false
  const header = req.headers?.['x-marketing-webhook-secret'] || req.headers?.['x-webhook-secret']
  const provided = header || body?.secret
  return String(provided || '') === expected
}

async function findQueueRow({ campaignId, leadId, email }) {
  if (!isSupabaseEnabled()) return null
  if (campaignId && leadId) {
    const rows = await supabaseRest(
      `${QUEUE_TABLE}?campaign_id=eq.${encodeURIComponent(campaignId)}&lead_id=eq.${encodeURIComponent(leadId)}&select=id,organization_id,campaign_id,lead_id,user_id,shard_name&limit=1`,
      {},
      { timeoutMs: 10_000 }
    )
    if (Array.isArray(rows) && rows[0]) return rows[0]
  }
  if (campaignId && email) {
    const rows = await supabaseRest(
      `${QUEUE_TABLE}?campaign_id=eq.${encodeURIComponent(campaignId)}&to_email=eq.${encodeURIComponent(String(email).toLowerCase())}&select=id,organization_id,campaign_id,lead_id,user_id,shard_name&limit=1`,
      {},
      { timeoutMs: 10_000 }
    )
    if (Array.isArray(rows) && rows[0]) return rows[0]
  }
  return null
}

async function patchLeadEngagement(row, event) {
  if (!row?.lead_id || !row?.user_id) return
  const user = { id: row.user_id, organizationId: row.organization_id || null }
  const patch =
    event === 'bounced'
      ? { emailBouncedAt: new Date().toISOString() }
      : event === 'opened'
        ? { lastEmailOpenedAt: new Date().toISOString() }
        : event === 'clicked'
          ? { lastEmailClickedAt: new Date().toISOString() }
          : null
  if (!patch) return
  await patchPipelineLeadsTable(user, [{ leadId: row.lead_id, updateCrm: (crm) => ({ ...crm, ...patch }) }])
}

/**
 * POST /api/v1/webhooks/marketing
 * Body: { event, organizationId, campaignId, leadId, email, messageId }
 */
export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])

  const body = getBody(req)
  if (!verifyWebhookSecret(req, body)) {
    return sendJson(res, 401, { error: 'Invalid webhook secret' })
  }

  const event = String(body.event || body.type || '').trim().toLowerCase()
  const organizationId = body.organizationId || body.organization_id || null
  const campaignId = body.campaignId || body.campaign_id || null
  const leadId = body.leadId || body.lead_id || null
  const email = body.email || body.to || null

  if (!event) return sendJson(res, 400, { error: 'event is required' })

  const row = await findQueueRow({ campaignId, leadId, email })
  const orgId = organizationId || row?.organization_id
  if (!orgId) return sendJson(res, 400, { error: 'organizationId required' })

  const deltas = { sent: 0, delivered: 0, opens: 0, clicks: 0, bounces: 0, unsubscribes: 0 }
  switch (event) {
    case 'delivered':
      deltas.delivered = 1
      break
    case 'opened':
    case 'open':
      deltas.opens = 1
      break
    case 'clicked':
    case 'click':
      deltas.clicks = 1
      break
    case 'bounced':
    case 'bounce':
      deltas.bounces = 1
      break
    case 'unsubscribed':
    case 'unsubscribe':
      deltas.unsubscribes = 1
      break
    default:
      return sendJson(res, 400, { error: `Unknown event: ${event}` })
  }

  const campaignScope = campaignId || row?.campaign_id || ''
  await incrementMarketingAnalyticsSnapshot({
    organizationId: orgId,
    campaignId: campaignScope,
    ...deltas,
  })
  await incrementMarketingAnalyticsSnapshot({
    organizationId: orgId,
    campaignId: '',
    ...deltas,
  })

  if (row && event === 'bounced') {
    await patchMarketingQueueRow(row.id, {
      status: 'failed',
      last_error: 'bounced',
    })
  }

  if (row) {
    await patchLeadEngagement(row, event === 'open' ? 'opened' : event)
  }

  return sendJson(res, 200, {
    ok: true,
    event,
    id: crypto.randomUUID(),
    organizationId: orgId,
    campaignId: campaignScope || null,
  })
}
