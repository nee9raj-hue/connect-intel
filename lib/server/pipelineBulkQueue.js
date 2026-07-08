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

/** Enrollments are seeded synchronously; only the send is deferred so the API responds fast. */
const DEFERRED_QUEUE_MIN = 1

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
      const lead = shapeResolvedLead({ ...(entry.lead || entry), ...(hit || {}), leadId })
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
  }

  let recipientCount = enrollments.length
  if (!enrollments.length) {
    recipientCount = await countPendingCampaignSends(campaign.id)
  }

  return { enrollments, recipientCount }
}

/** Send the already-seeded enrollments (inline for ≤25, worker queue for larger). */
async function sendPipelineBulkQueue(user, campaign, recipientCount) {
  const sendResult = await executeCampaignSendByMode(user, campaign.id, recipientCount, {
    source: 'pipeline_bulk',
  })

  if (sendResult.mode === EMAIL_SEND_MODE.INLINE && (sendResult.pendingSends ?? 0) <= 0) {
    invalidatePipelineIndex(pipelineShardNameForUser(user))
  }

  return sendResult
}

async function scheduleDeferredBulkSend(user, campaign, recipientCount) {
  const work = () =>
    sendPipelineBulkQueue(user, campaign, recipientCount).catch(async (err) => {
      // Enrollments are already seeded, so the status-poll self-heal (or a worker)
      // will retry the send — leave status as 'queued' rather than 'failed'.
      console.error('pipeline bulk send defer failed:', err?.message || err)
    })

  try {
    const { waitUntil } = await import('@vercel/functions')
    waitUntil(work())
  } catch {
    await work()
  }
}

/**
 * Queue or inline-send a pipeline bulk campaign based on recipient count (≤10 inline, >10 worker).
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

  // Seed enrollments synchronously so the audience is durable even if the deferred
  // send task is dropped by the platform. Only the send itself is deferred.
  await setCampaignSendStatus(campaign.id, 'queued')
  const { recipientCount } = await seedPipelineBulkQueue(user, body, campaign, validRows, storeBefore)

  if (recipientCount >= DEFERRED_QUEUE_MIN) {
    await scheduleDeferredBulkSend(user, campaign, recipientCount)

    return {
      queued: true,
      campaignId: campaign.id,
      sendable: validRows.length,
      skipped,
      enrolledThisRequest: recipientCount,
      sent: 0,
      failed: 0,
      firstError: null,
      pendingSends: recipientCount,
      queuedSends: recipientCount,
      done: false,
      background: true,
      backgroundJobId: null,
      mode: EMAIL_SEND_MODE.QUEUED,
      sendStatus: 'queued',
      workerOnline: null,
      workerHint:
        'Campaign queued. Emails send in the background — you can close this tab and track progress on Pipeline.',
    }
  }

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
