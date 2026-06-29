import { readStore } from './store.js'
import { buildOrgUserResponse } from './organizations.js'
import { readCampaignSendShard } from './marketingCampaignSendShard.js'
import { bumpCampaignStatsShard } from './marketingCampaignStatsShard.js'
import {
  claimMarketingEmailQueueRows,
  marketingSqlQueueActive,
  patchMarketingQueueRow,
} from './marketingEmailQueue.js'
import { sendMarketingMessage } from './marketingSend.js'
import {
  getMarketingTemplate,
  resolveCampaignContent,
  resolveCampaignSender,
} from './marketingCampaigns.js'
import { incrementMarketingAnalyticsSnapshot } from './marketingAnalyticsSnapshots.js'
import { readPipelineLeadsByIds, patchPipelineLeadsTable } from './pipelineLeadsTable.js'

const SEND_META_SLICES = [
  'marketingSuppressions',
  'marketingForms',
  'users',
  'organizations',
  'organizationMemberships',
]

function buildLeadFromQueueRow(row) {
  return {
    id: row.lead_id,
    email: row.to_email,
    firstName: row.first_name || '',
    first_name: row.first_name || '',
  }
}

async function loadLeadsForQueueRows(rows) {
  const byShard = new Map()
  for (const row of rows || []) {
    const shard = row.shard_name
    if (!shard || !row.lead_id) continue
    if (!byShard.has(shard)) byShard.set(shard, new Set())
    byShard.get(shard).add(row.lead_id)
  }
  const leadById = new Map()
  for (const [shard, idSet] of byShard) {
    const entries = (await readPipelineLeadsByIds(shard, [...idSet])) || []
    for (const entry of entries) {
      const lid = entry?.lead?.id || entry?.leadId
      if (lid) leadById.set(lid, entry.lead || entry)
    }
  }
  return leadById
}

async function loadSendContext(userId) {
  const store = await readStore({ only: SEND_META_SLICES })
  const raw = store.users?.find((u) => u.id === userId)
  if (!raw) return null
  return {
    store,
    user: buildOrgUserResponse(raw, store),
  }
}

async function loadCampaignBundle(campaignId) {
  const shard = await readCampaignSendShard(campaignId)
  if (shard) return shard
  const store = await readStore({ only: ['marketingCampaigns', 'marketingTemplates'] })
  return store.marketingCampaigns?.find((c) => c.id === campaignId) || null
}

async function sendQueueRow(row, ctx, leadById) {
  const campaign = ctx.campaign
  const template = ctx.template
  const { steps } = resolveCampaignContent(campaign, template)
  const step = steps[0]
  if (!step) {
    return { sent: false, error: 'Campaign has no message step' }
  }

  const lead = leadById?.get(row.lead_id) || buildLeadFromQueueRow(row)
  return sendMarketingMessage({
    store: ctx.store,
    user: ctx.user,
    lead,
    leadId: row.lead_id,
    subject: step.subject,
    body: step.body,
    blocks: step.blocks,
    design: step.design,
    previewText: step.previewText,
    template,
    campaignId: row.campaign_id,
    stepIndex: 0,
    enrollmentId: row.enrollment_id,
    emailProvider: campaign.emailProvider,
  })
}

async function markLeadDeliveryStatus(user, leadId, patch) {
  try {
    await patchPipelineLeadsTable(user, [
      {
        leadId,
        updateCrm: (crm) => ({
          ...crm,
          ...patch,
          lastMarketingAt: new Date().toISOString(),
        }),
      },
    ], { trustOrgScope: true })
  } catch (err) {
    console.warn('marketing queue lead patch:', err?.message || err)
  }
}

/**
 * Process a slice of pending SQL queue rows. Safe for Vercel cron / fire-and-forget.
 * Never loads full pipeline shards — only indexed pipeline_leads patches per send.
 */
export async function processMarketingEmailQueue({
  limit = 50,
  maxMs = 110_000,
  workerId,
} = {}) {
  if (!marketingSqlQueueActive()) {
    return { ok: true, mode: 'disabled', claimed: 0, sent: 0, failed: 0 }
  }

  const started = Date.now()
  const rows = await claimMarketingEmailQueueRows({ limit, workerId })
  if (!rows.length) {
    return { ok: true, mode: 'sql_queue', claimed: 0, sent: 0, failed: 0 }
  }

  let sent = 0
  let failed = 0
  let skipped = 0
  let firstError = null
  const contextCache = new Map()
  const campaignCache = new Map()
  const leadById = await loadLeadsForQueueRows(rows)

  for (const row of rows) {
    if (Date.now() - started > maxMs) break

    try {
      let ctx = contextCache.get(row.user_id)
      if (!ctx) {
        const loaded = await loadSendContext(row.user_id)
        if (!loaded) {
          await patchMarketingQueueRow(row.id, {
            status: 'failed',
            last_error: 'Sender user not found',
          })
          failed += 1
          continue
        }
        ctx = loaded
        contextCache.set(row.user_id, ctx)
      }

      let campaign = campaignCache.get(row.campaign_id)
      if (!campaign) {
        campaign = await loadCampaignBundle(row.campaign_id)
        if (!campaign) {
          await patchMarketingQueueRow(row.id, {
            status: 'failed',
            last_error: 'Campaign not found',
          })
          failed += 1
          continue
        }
        campaignCache.set(row.campaign_id, campaign)
      }

      const template = getMarketingTemplate(ctx.store, ctx.user, campaign.templateId)
      const result = await sendQueueRow(row, { ...ctx, campaign, template }, leadById)

      if (result.suppressed || result.skipped) {
        await patchMarketingQueueRow(row.id, {
          status: 'skipped',
          last_error: result.error || 'skipped',
          sent_at: new Date().toISOString(),
        })
        skipped += 1
        continue
      }

      if (result.sent) {
        const sentAt = new Date().toISOString()
        await patchMarketingQueueRow(row.id, {
          status: 'sent',
          provider_message_id: result.messageId || null,
          sent_at: sentAt,
          last_error: null,
        })
        sent += 1
        await bumpCampaignStatsShard(row.campaign_id, { sent: 1 })
        const { recordCampaignQueueSend } = await import('./marketingCampaigns.js')
        await recordCampaignQueueSend(row.campaign_id, row.enrollment_id, {
          ...result,
          sentAt,
        })
        const orgId = row.organization_id || ctx.user.organizationId
        if (orgId) {
          void incrementMarketingAnalyticsSnapshot({
            organizationId: orgId,
            campaignId: row.campaign_id,
            sent: 1,
            delivered: 1,
          })
          void incrementMarketingAnalyticsSnapshot({
            organizationId: orgId,
            campaignId: '',
            sent: 1,
            delivered: 1,
          })
        }
        await markLeadDeliveryStatus(ctx.user, row.lead_id, { lastEmailSentAt: new Date().toISOString() })
      } else {
        await patchMarketingQueueRow(row.id, {
          status: 'failed',
          last_error: String(result.error || 'send failed').slice(0, 240),
        })
        failed += 1
        if (!firstError) firstError = result.error || 'send failed'
        if (row.organization_id) {
          void incrementMarketingAnalyticsSnapshot({
            organizationId: row.organization_id,
            campaignId: row.campaign_id,
            bounces: /bounce/i.test(result.error || '') ? 1 : 0,
          })
        }
      }
    } catch (error) {
      await patchMarketingQueueRow(row.id, {
        status: 'failed',
        last_error: String(error?.message || error).slice(0, 240),
      })
      failed += 1
      if (!firstError) firstError = error?.message || String(error)
    }
  }

  return {
    ok: true,
    mode: 'sql_queue',
    claimed: rows.length,
    sent,
    failed,
    skipped,
    firstError,
    elapsedMs: Date.now() - started,
  }
}
