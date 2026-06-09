import { marketingScopeKey } from './marketingAccess.js'
import { findPipelineEntry } from './pipelineAccess.js'
import { leadHasSendableEmail } from '../leadEmailSendable.js'
import { BULK_EMAIL_MAX } from '../bulkEmailLimits.js'
import {
  appendPipelineBulkEnrollments,
  buildPipelineBulkEnrollment,
  bumpPipelineBulkCampaignStats,
  createPipelineBulkCampaign,
  findPipelineBulkCampaign,
  seedPipelineBulkEnrollments,
} from './pipelineBulkCampaign.js'
import {
  countPendingCampaignSends,
  countQueuedCampaignEnrollments,
  processCampaignSendBurst,
} from './marketingCampaigns.js'
import { isRedisEnabled } from './infra/config.js'
import { enqueuePipelineBulkDrain } from './queue/producer.js'
import { triggerQueueDrainNow } from './queue/triggerDrain.js'
import { invalidatePipelineIndex } from './pipelineIndex.js'
import { loadPipelineStoreContext, pipelineShardNameForUser } from './pipelineShard.js'
import { readCampaignEnrollments } from './marketingEnrollmentShard.js'

/** Stagger sends: 50 per wave, 3 seconds apart — reduces Gmail + DB spikes without Redis. */
export const PIPELINE_BULK_SEND_WAVE_SIZE = 50
export const PIPELINE_BULK_SEND_WAVE_DELAY_MS = 3000

function staggeredSendAt(index) {
  const wave = Math.floor(index / PIPELINE_BULK_SEND_WAVE_SIZE)
  return new Date(Date.now() + wave * PIPELINE_BULK_SEND_WAVE_DELAY_MS).toISOString()
}

/**
 * Queue a pipeline bulk campaign — enroll only, no Gmail sends in this request.
 * One shard read for validation; one enrollment write; minimal store updates.
 */
export async function queuePipelineBulkCampaign(user, metaStore, body) {
  const leadIds = [...new Set(Array.isArray(body.leadIds) ? body.leadIds : [])]
  if (!leadIds.length) throw new Error('leadIds array is required')
  if (leadIds.length > BULK_EMAIL_MAX) {
    throw new Error(`Maximum ${BULK_EMAIL_MAX} leads per batch`)
  }

  const subject = String(body.subject || '').trim()
  const emailBody = String(body.body || '').trim()
  const useAiPerLead = Boolean(body.useAiPerLead)

  if (useAiPerLead && !String(body.agenda || '').trim()) {
    throw new Error('Agenda is required for AI personalization')
  }
  if (!useAiPerLead && (!subject || !emailBody)) {
    throw new Error('Subject line and message body are required')
  }

  const { pipelineStore, visible } = await loadPipelineStoreContext(user, { shardOnly: true })
  const storeBefore = { ...metaStore, savedLeads: visible }

  const validRows = []
  const skipped = []

  for (const leadId of leadIds) {
    const entry = findPipelineEntry(storeBefore, user, leadId)
    if (!entry) {
      skipped.push({ leadId, reason: 'not_in_pipeline' })
      continue
    }
    const lead = entry.lead || entry
    if (!leadHasSendableEmail(lead)) {
      skipped.push({ leadId, reason: 'no_email' })
      continue
    }
    validRows.push({ leadId, lead })
  }

  if (!validRows.length) {
    return { queued: false, sendable: 0, skipped, campaignId: null, pendingSends: 0 }
  }

  const scope = marketingScopeKey(user)
  let campaign = null
  const existingCampaignId = String(body.campaignId || '').trim() || null

  if (existingCampaignId) {
    campaign = findPipelineBulkCampaign(storeBefore, user, existingCampaignId)
    if (!campaign) throw new Error('Campaign not found for this bulk send')
  } else {
    campaign = await createPipelineBulkCampaign(storeBefore, user, {
      subject: subject || 'Pipeline email',
      body: emailBody || '',
      pipelineBulkOptions: {
        useAiPerLead,
        agenda: String(body.agenda || '').trim(),
        keyPoints: String(body.keyPoints || '').trim(),
        senderCompany: String(body.senderCompany || '').trim(),
        purpose: String(body.purpose || 'introduction').trim(),
        cc: String(body.cc || '').trim(),
        aiGenerated: Boolean(body.aiGenerated),
      },
    })
  }

  const existing = existingCampaignId ? await readCampaignEnrollments(campaign.id) : []
  const done = new Set(
    existing.filter((e) => e.status === 'completed' || e.status === 'failed').map((e) => e.leadId)
  )
  const pendingRows = validRows.filter((row) => !done.has(row.leadId))

  const enrollments = pendingRows.map(({ leadId, lead }, index) => {
    const enrollment = buildPipelineBulkEnrollment({
      scope,
      campaignId: campaign.id,
      leadId,
      email: lead.email,
      index: existing.length + index,
    })
    enrollment.nextSendAt = staggeredSendAt(index)
    return enrollment
  })

  if (enrollments.length) {
    if (existingCampaignId) {
      await appendPipelineBulkEnrollments(campaign.id, enrollments)
    } else {
      await seedPipelineBulkEnrollments(campaign.id, enrollments)
    }
    await bumpPipelineBulkCampaignStats(storeBefore, user, campaign.id, {
      enrolled: enrollments.length,
      sent: 0,
      failed: 0,
    })
  }

  const pendingSends = await countPendingCampaignSends(campaign.id)
  const queuedSends = await countQueuedCampaignEnrollments(campaign.id)

  let workerJobId = null
  if (isRedisEnabled() && pendingSends > 0) {
    workerJobId = await enqueuePipelineBulkDrain(user.id, campaign.id)
    triggerQueueDrainNow()
  }

  return {
    queued: true,
    campaignId: campaign.id,
    sendable: validRows.length,
    skipped,
    pendingSends,
    queuedSends,
    enrolledThisRequest: enrollments.length,
    workerJobId,
    asyncMode: Boolean(workerJobId),
  }
}

/** Process one worker burst for a pipeline_bulk campaign (isolated from CRM reads). */
export async function drainPipelineBulkCampaign(user, campaignId, options = {}) {
  const burst = await processCampaignSendBurst(user, campaignId, options)
  const pendingSends = burst.pendingSends ?? 0
  if (pendingSends <= 0) {
    invalidatePipelineIndex(pipelineShardNameForUser(user))
  }
  return {
    ...burst,
    pendingSends,
    sent: burst.sent ?? 0,
    failed: burst.failed ?? 0,
    done: pendingSends <= 0,
  }
}
