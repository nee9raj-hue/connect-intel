/**
 * Enterprise Messaging Engine (EMP) — single entry for Pipeline, Marketing, sequences.
 * Validation -> enroll -> sync -> queue/worker send.
 */
import { BULK_EMAIL_MAX } from '../../bulkEmailLimits.js'
import { executeCampaignSendByMode } from '../email/dualModeSend.js'
import { setCampaignSendStatus } from '../email/campaignLifecycle.js'
import { isBackgroundEmailEnabled } from '../infra/config.js'
import { readWorkerHeartbeat } from '../infra/workerHealth.js'
import { queuePipelineBulkCampaign } from '../pipelineBulkQueue.js'
import { createMessagingContext, messagingLog, messagingWarn } from './observability.js'
import { validateMessagingRecipients } from './validate.js'

export { validateMessagingRecipients }

/**
 * Pipeline bulk send — wraps queuePipelineBulkCampaign with validation + logging.
 */
export async function createPipelineBulkMessagingJob(user, metaStore, body) {
  const leadIds = [...new Set(Array.isArray(body.leadIds) ? body.leadIds : [])]
  const ctx = createMessagingContext(user, { source: 'pipeline_bulk', campaignId: body.campaignId })

  if (!leadIds.length) throw new Error('leadIds array is required')
  if (leadIds.length > BULK_EMAIL_MAX) {
    throw new Error(`Maximum ${BULK_EMAIL_MAX} leads per batch`)
  }

  messagingLog(ctx, 'validating_recipients', { count: leadIds.length })

  const { loadPipelineStoreForLeadIds } = await import('../pipelineShard.js')
  const { visible } = await loadPipelineStoreForLeadIds(user, leadIds)
  const storeBefore = { ...metaStore, savedLeads: visible }

  const resolved = Array.isArray(body.resolvedRecipients) ? body.resolvedRecipients : null
  const byId = resolved?.length
    ? new Map(resolved.map((row) => [String(row.leadId || row.id), row]))
    : null

  const { valid, skipped } = validateMessagingRecipients(storeBefore, user, leadIds, {
    resolvedByLeadId: byId,
  })

  if (!valid.length) {
    messagingWarn(ctx, 'no_valid_recipients', { skipped: skipped.length })
    return { queued: false, sendable: 0, skipped, campaignId: null, pendingSends: 0, mode: null }
  }

  const filteredBody = {
    ...body,
    leadIds: valid.map((r) => r.leadId),
    resolvedRecipients: valid.map(({ leadId, lead }) => ({
      leadId,
      email: lead.email,
      firstName: lead.firstName,
      lastName: lead.lastName,
      company: lead.company,
      title: lead.title,
    })),
  }

  messagingLog(ctx, 'enrolling_recipients', { valid: valid.length, skipped: skipped.length })

  const result = await queuePipelineBulkCampaign(user, metaStore, filteredBody)
  ctx.campaignId = result.campaignId
  ctx.jobId = result.campaignId || ctx.jobId

  if (result.mode === 'queued' || result.background) {
    messagingLog(ctx, 'queued_for_worker', {
      pending: result.pendingSends,
      workerOnline: result.workerOnline,
    })
  } else {
    messagingLog(ctx, 'send_complete', {
      sent: result.sent,
      failed: result.failed,
      firstError: result.firstError,
    })
  }

  if (result.firstError && !result.sent && (result.failed ?? 0) > 0) {
    messagingWarn(ctx, 'send_failed', { error: result.firstError })
  }

  const worker = await readWorkerHeartbeat().catch(() => null)
  return {
    ...result,
    skipped: [...skipped, ...(result.skipped || [])],
    workerOnline: result.workerOnline ?? Boolean(worker?.ok),
    workerHint:
      result.workerHint ||
      (isBackgroundEmailEnabled() && worker?.ok
        ? 'Emails are sending in the background — you can close this tab.'
        : null),
  }
}

/**
 * Start or continue a campaign send (Marketing Hub or pipeline_bulk after enroll).
 */
export async function startMessagingCampaignSend(user, campaignId, recipientCount, options = {}) {
  const ctx = createMessagingContext(user, {
    source: options.source || 'marketing',
    campaignId,
  })

  messagingLog(ctx, 'start_send', { recipients: recipientCount })
  await setCampaignSendStatus(campaignId, 'preparing').catch(() => {})

  const sendResult = await executeCampaignSendByMode(user, campaignId, recipientCount, {
    source: options.source || 'marketing',
  })

  messagingLog(ctx, 'send_enqueued', {
    mode: sendResult.mode,
    pending: sendResult.pendingSends,
    sent: sendResult.sent,
    failed: sendResult.failed,
  })

  return { ...sendResult, correlationId: ctx.correlationId, jobId: ctx.jobId }
}
