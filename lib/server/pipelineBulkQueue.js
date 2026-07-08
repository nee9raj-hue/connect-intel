import { marketingScopeKey } from './marketingAccess.js'
import { findPipelineEntry } from './pipelineAccess.js'
import { leadCanReceiveCommercialEmail, leadHasSendableEmail } from '../leadEmailSendable.js'
import { BULK_EMAIL_MAX } from '../bulkEmailLimits.js'
import {
  appendPipelineBulkEnrollments,
  buildPipelineBulkEnrollment,
  bumpPipelineBulkCampaignStats,
  createPipelineBulkCampaign,
  findPipelineBulkCampaignByShard,
  seedPipelineBulkEnrollments,
} from './pipelineBulkCampaign.js'
import { countPendingCampaignSends, processCampaignSendBurst } from './marketingCampaigns.js'
import { executeCampaignSendByMode } from './email/dualModeSend.js'
import { EMAIL_SEND_MODE } from './email/sendMode.js'
import { setCampaignSendStatus } from './email/campaignLifecycle.js'
import { invalidatePipelineIndex } from './pipelineIndex.js'
import { pipelineShardNameForUser } from './pipelineShard.js'
import { readCampaignEnrollments } from './marketingEnrollmentShard.js'

function shapeResolvedLead(row) {
  const leadId = String(row.leadId || row.id || '').trim()
  return {
    id: leadId,
    email: String(row.email || '').trim(),
    firstName: String(row.firstName || '').trim(),
    lastName: String(row.lastName || '').trim(),
    company: String(row.company || '').trim(),
    title: String(row.title || '').trim(),
  }
}

async function resolveBulkValidRows(user, metaStore, leadIds, body) {
  const skipped = []
  const validRows = []
  const resolved = Array.isArray(body.resolvedRecipients) ? body.resolvedRecipients : null

  if (resolved?.length) {
    const { loadPipelineStoreForLeadIds } = await import('./pipelineShard.js')
    const { visible } = await loadPipelineStoreForLeadIds(user, leadIds)
    const storeBefore = { ...metaStore, savedLeads: visible }
    const byId = new Map(resolved.map((row) => [String(row.leadId || row.id), row]))
    for (const leadId of leadIds) {
      const entry = findPipelineEntry(storeBefore, user, leadId)
      if (!entry) {
        skipped.push({ leadId, reason: 'not_in_pipeline' })
        continue
      }
      const hit = byId.get(String(leadId))
      // Evaluate email + consent on the FULL merged lead — the resolved payload from the
      // client does not carry consent fields, so shaping first would drop them and make
      // every recipient look like "no_consent".
      const fullLead = { ...(entry.lead || entry), ...(hit || {}), id: leadId }
      if (!leadHasSendableEmail(fullLead)) {
        skipped.push({ leadId, reason: 'no_email' })
        continue
      }
      if (!leadCanReceiveCommercialEmail(fullLead)) {
        skipped.push({ leadId, reason: 'no_consent' })
        continue
      }
      validRows.push({ leadId, lead: shapeResolvedLead({ ...fullLead, leadId }) })
    }
    return { validRows, skipped, storeBefore }
  }

  const { loadPipelineStoreForLeadIds } = await import('./pipelineShard.js')
  const { visible } = await loadPipelineStoreForLeadIds(user, leadIds)
  const storeBefore = { ...metaStore, savedLeads: visible }

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
    if (!leadCanReceiveCommercialEmail(lead)) {
      skipped.push({ leadId, reason: 'no_consent' })
      continue
    }
    validRows.push({ leadId, lead })
  }

  return { validRows, skipped, storeBefore }
}

async function getOrCreatePipelineBulkCampaign(user, body, existingCampaignId) {
  const subject = String(body.subject || '').trim()
  const emailBody = String(body.body || '').trim()
  const useAiPerLead = Boolean(body.useAiPerLead)

  if (existingCampaignId) {
    const campaign = await findPipelineBulkCampaignByShard(user, existingCampaignId)
    if (!campaign) throw new Error('Campaign not found for this bulk send')
    return campaign
  }

  return createPipelineBulkCampaign(user, {
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

/**
 * Durably record recipients (enrollments) for the campaign. Runs synchronously in
 * the request so the audience is never lost if the deferred send task is dropped.
 */
async function seedPipelineBulkQueue(user, body, campaign, validRows, storeBefore) {
  const scope = marketingScopeKey(user)
  const existingCampaignId = String(body.campaignId || '').trim() || null

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
    enrollment.nextSendAt = new Date().toISOString()
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
    const { syncCampaignV3AfterSave, syncRecipientsAfterEnroll } = await import('./campaignsV3Sync.js')
    syncCampaignV3AfterSave({ campaign, user })
    syncRecipientsAfterEnroll({
      campaign,
      enrollments,
      store: storeBefore,
      user,
    })
  }

  let recipientCount = enrollments.length
  if (!enrollments.length) {
    recipientCount = await countPendingCampaignSends(campaign.id)
  }

  return { enrollments, recipientCount }
}

/** Enqueue the already-seeded enrollments via the unified messaging send path. */
async function sendPipelineBulkQueue(user, campaign, recipientCount) {
  const sendResult = await executeCampaignSendByMode(user, campaign.id, recipientCount, {
    source: 'pipeline_bulk',
  })

  if (sendResult.mode === EMAIL_SEND_MODE.INLINE && (sendResult.pendingSends ?? 0) <= 0) {
    invalidatePipelineIndex(pipelineShardNameForUser(user))
  }

  return sendResult
}

/**
 * Queue pipeline bulk campaign through the unified messaging engine (worker when Redis is on).
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

  const { validRows, skipped, storeBefore } = await resolveBulkValidRows(user, metaStore, leadIds, body)

  if (!validRows.length) {
    return { queued: false, sendable: 0, skipped, campaignId: null, pendingSends: 0, mode: null }
  }

  const existingCampaignId = String(body.campaignId || '').trim() || null
  const campaign = await getOrCreatePipelineBulkCampaign(user, body, existingCampaignId)

  // Seed enrollments synchronously so the audience is durable before enqueue.
  await setCampaignSendStatus(campaign.id, 'queued')
  const { recipientCount } = await seedPipelineBulkQueue(user, body, campaign, validRows, storeBefore)

  const sendResult = await sendPipelineBulkQueue(user, campaign, recipientCount)

  return {
    queued: true,
    campaignId: campaign.id,
    sendable: validRows.length,
    skipped,
    enrolledThisRequest: recipientCount,
    ...sendResult,
  }
}

/** Process one worker burst for a pipeline_bulk campaign (worker/cron safety net). */
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
