import { processCampaignSendBurst } from '../marketingCampaigns.js'
import { isBackgroundEmailEnabled } from '../infra/config.js'
import { readWorkerHeartbeat } from '../infra/workerHealth.js'
import { startBackgroundCampaignSend } from './campaignSendOrchestrator.js'
import { setCampaignSendStatus } from './campaignLifecycle.js'
import {
  EMAIL_SEND_MODE,
  inlineSendBudgetMs,
  resolveEmailSendMode,
} from './sendMode.js'
import { triggerQueueDrainNow } from '../queue/triggerDrain.js'
import { drainQueueJobsOnce } from '../queue/drainOnce.js'

async function schedulePostResponseDrain() {
  try {
    const { waitUntil } = await import('@vercel/functions')
    waitUntil(
      drainQueueJobsOnce({ maxMs: 240_000 }).catch((err) => {
        console.warn('waitUntil queue drain failed:', err?.message || err)
      })
    )
  } catch {
    triggerQueueDrainNow()
    triggerQueueDrainNow({ afterMs: 8_000 })
  }
}

export function assertRedisForQueuedSends() {
  if (!isBackgroundEmailEnabled()) {
    const err = new Error(
      'Bulk email (>10 recipients) requires Redis. Configure REDIS_URL on Vercel and deploy the Railway worker.'
    )
    err.code = 'QUEUED_EMAIL_REDIS_REQUIRED'
    throw err
  }
}

/**
 * After enrollments exist: inline send (≤10) or queue+worker (>10).
 * Never inline-sends bulk batches.
 */
export async function executeCampaignSendByMode(user, campaignId, recipientCount, options = {}) {
  const mode = resolveEmailSendMode(recipientCount)
  const count = Math.max(0, Number(recipientCount) || 0)

  if (mode === EMAIL_SEND_MODE.INLINE) {
    if (count > 0) {
      await setCampaignSendStatus(campaignId, 'sending')
    }
    const burst = await processCampaignSendBurst(user, campaignId, {
      limit: Math.min(count, 10),
      maxMs: inlineSendBudgetMs(count),
    })
    const pendingAfter = burst.pendingSends ?? 0
    const sent = burst.sent ?? 0
    const failed = burst.failed ?? 0
    let sendStatus = 'sending'
    if (pendingAfter <= 0 && sent > 0) {
      sendStatus = 'completed'
      await setCampaignSendStatus(campaignId, 'completed')
    } else if (pendingAfter <= 0 && failed > 0 && sent === 0) {
      sendStatus = 'failed'
      await setCampaignSendStatus(campaignId, 'failed')
    } else if (sent > 0) {
      sendStatus = 'sending'
    }

    return {
      mode: EMAIL_SEND_MODE.INLINE,
      campaignId,
      sent,
      failed,
      firstError: burst.firstError || null,
      pendingSends: pendingAfter,
      queuedSends: pendingAfter,
      done: pendingAfter <= 0,
      background: false,
      backgroundJobId: null,
      sendStatus,
      workerOnline: null,
    }
  }

  if (!isBackgroundEmailEnabled()) {
    await setCampaignSendStatus(campaignId, 'sending')
    return {
      mode: EMAIL_SEND_MODE.BROWSER_DRAIN,
      campaignId,
      sent: 0,
      failed: 0,
      firstError: null,
      pendingSends: count,
      queuedSends: count,
      done: false,
      background: false,
      backgroundJobId: null,
      sendStatus: 'sending',
      workerOnline: false,
      workerHint: 'Keep this tab open while emails send.',
    }
  }

  assertRedisForQueuedSends()

  const worker = await readWorkerHeartbeat()

  await setCampaignSendStatus(campaignId, 'queued')

  const background = await startBackgroundCampaignSend(campaignId, user.id, {
    source: options.source || 'campaign',
    delayMs: 0,
  })

  if (!background?.started) {
    const err = new Error(
      'Could not enqueue campaign for background sending. Check REDIS_URL and Railway worker (npm run workers).'
    )
    err.code = 'QUEUED_EMAIL_ENQUEUE_FAILED'
    throw err
  }

  await setCampaignSendStatus(campaignId, 'preparing')
  await schedulePostResponseDrain()

  return {
    mode: EMAIL_SEND_MODE.QUEUED,
    campaignId,
    sent: 0,
    failed: 0,
    firstError: null,
    pendingSends: count,
    queuedSends: count,
    done: false,
    background: true,
    backgroundJobId: background.jobId || null,
    sendStatus: 'preparing',
    workerOnline: Boolean(worker?.ok),
    workerHint: worker?.ok
      ? null
      : 'Campaign queued. Deploy the Railway worker (docs/RAILWAY_WORKER.md) if sends do not start within a minute.',
  }
}
