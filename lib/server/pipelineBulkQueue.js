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
import { countPendingCampaignSends, processCampaignSendBurst } from './marketingCampaigns.js'
import { executeCampaignSendByMode } from './email/dualModeSend.js'
import { EMAIL_SEND_MODE } from './email/sendMode.js'
import { setCampaignSendStatus } from './email/campaignLifecycle.js'
import { invalidatePipelineIndex } from './pipelineIndex.js'
import { pipelineShardNameForUser } from './pipelineShard.js'
import { readCampaignEnrollments } from './marketingEnrollmentShard.js'

/** Above this count, respond immediately and finish enroll + worker kickoff in waitUntil. */
const DEFERRED_QUEUE_MIN = 12

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
    const byId = new Map(resolved.map((row) => [String(row.leadId || row.id), row]))
    for (const leadId of leadIds) {
      const hit = byId.get(String(leadId))
      if (!hit) {
        skipped.push({ leadId, reason: 'not_in_pipeline' })
        continue
      }
      const lead = shapeResolvedLead({ ...hit, leadId })
      if (!leadHasSendableEmail(lead)) {
        skipped.push({ leadId, reason: 'no_email' })
        continue
      }
      validRows.push({ leadId, lead })
    }
    return { validRows, skipped, storeBefore: { ...metaStore, savedLeads: [] } }
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

async function getOrCreatePipelineBulkCampaign(user, storeBefore, body, existingCampaignId) {
  const subject = String(body.subject || '').trim()
  const emailBody = String(body.body || '').trim()
  const useAiPerLead = Boolean(body.useAiPerLead)

  if (existingCampaignId) {
    const campaign = findPipelineBulkCampaign(storeBefore, user, existingCampaignId)
    if (!campaign) throw new Error('Campaign not found for this bulk send')
    return campaign
  }

  return createPipelineBulkCampaign(storeBefore, user, {
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

async function finalizePipelineBulkQueue(user, metaStore, body, campaign, validRows, skipped, storeBefore) {
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

  const sendResult = await executeCampaignSendByMode(user, campaign.id, recipientCount, {
    source: 'pipeline_bulk',
  })

  if (sendResult.mode === EMAIL_SEND_MODE.INLINE && (sendResult.pendingSends ?? 0) <= 0) {
    invalidatePipelineIndex(pipelineShardNameForUser(user))
  }

  return {
    queued: true,
    campaignId: campaign.id,
    sendable: validRows.length,
    skipped,
    enrolledThisRequest: enrollments.length,
    ...sendResult,
  }
}

async function scheduleDeferredBulkQueue(user, metaStore, body, campaign, validRows, skipped, storeBefore) {
  const work = () =>
    finalizePipelineBulkQueue(user, metaStore, body, campaign, validRows, skipped, storeBefore).catch(
      async (err) => {
        console.error('pipeline bulk queue defer failed:', err?.message || err)
        await setCampaignSendStatus(campaign.id, 'failed').catch(() => {})
      }
    )

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
  const campaign = await getOrCreatePipelineBulkCampaign(user, storeBefore, body, existingCampaignId)

  if (validRows.length >= DEFERRED_QUEUE_MIN) {
    await setCampaignSendStatus(campaign.id, 'preparing')
    await scheduleDeferredBulkQueue(user, metaStore, body, campaign, validRows, skipped, storeBefore)

    return {
      queued: true,
      campaignId: campaign.id,
      sendable: validRows.length,
      skipped,
      enrolledThisRequest: 0,
      sent: 0,
      failed: 0,
      firstError: null,
      pendingSends: validRows.length,
      queuedSends: validRows.length,
      done: false,
      background: true,
      backgroundJobId: null,
      mode: EMAIL_SEND_MODE.QUEUED,
      sendStatus: 'preparing',
      workerOnline: null,
      workerHint:
        'Campaign queued. Emails send in the background — you can close this tab and track progress on Pipeline.',
    }
  }

  return finalizePipelineBulkQueue(user, metaStore, body, campaign, validRows, skipped, storeBefore)
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
