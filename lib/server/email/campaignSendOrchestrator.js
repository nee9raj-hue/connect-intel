import { processCampaignSendBurst } from '../marketingCampaigns.js'
import { isBackgroundEmailEnabled } from '../infra/config.js'
import { enqueueJob } from '../queue/producer.js'
import { triggerQueueDrainNow } from '../queue/triggerDrain.js'
import { JOB_TYPES, QUEUE_NAMES } from '../queue/names.js'
import { bullJobId } from '../queue/jobId.js'
import { setCampaignSendStatus } from './campaignLifecycle.js'
import { getCampaignSendProgress } from './campaignProgress.js'
import { delayBeforeNextBurst } from './providerRateLimits.js'
import { createCampaignSendSession } from './campaignSendSession.js'

function campaignJobId(campaignId) {
  return bullJobId('campaign-send', campaignId)
}

/**
 * Start true background sending — browser not required.
 * Requires REDIS_URL + Railway worker (`npm run workers`).
 */
export async function startBackgroundCampaignSend(campaignId, userId, options = {}) {
  if (!isBackgroundEmailEnabled()) {
    return { started: false, reason: 'background_email_disabled' }
  }

  await setCampaignSendStatus(campaignId, 'queued')

  const jobId = await enqueueJob(
    QUEUE_NAMES.EMAIL,
    JOB_TYPES.EMAIL_CAMPAIGN_SEND,
    { userId, campaignId, source: options.source || 'marketing' },
    {
      jobId: campaignJobId(campaignId),
      delayMs: options.delayMs ?? 0,
    }
  )

  if (!jobId) {
    return { started: false, reason: 'enqueue_failed' }
  }

  await setCampaignSendStatus(campaignId, 'preparing')
  triggerQueueDrainNow()
  triggerQueueDrainNow({ afterMs: 8_000 })

  return {
    started: true,
    jobId,
    campaignId,
    background: true,
  }
}

/**
 * Worker job: one burst, then re-enqueue if more pending (idempotent per enrollment).
 */
export async function processBackgroundCampaignSendJob(user, campaignId) {
  const sendSession = await createCampaignSendSession(user, campaignId)
  const campaign = sendSession.campaign

  if (!campaign) throw new Error('Campaign not found')
  if (['paused', 'stopped', 'archived', 'cancelled'].includes(campaign.status)) {
    return { skipped: true, reason: 'campaign_not_active' }
  }

  await setCampaignSendStatus(campaignId, 'sending')

  const burst = await processCampaignSendBurst(user, campaignId, {
    limit: 8,
    maxMs: 85_000,
    sendSession,
  })

  const progress = await getCampaignSendProgress(campaignId, user)
  const provider = campaign.emailProvider || burst.campaign?.lastSendProvider || 'gmail'

  if (progress.done) {
    await setCampaignSendStatus(campaignId, 'completed')
    return { ...burst, progress, done: true }
  }

  const delayMs = delayBeforeNextBurst(provider, { pending: progress.pendingSends })

  await enqueueJob(
    QUEUE_NAMES.EMAIL,
    JOB_TYPES.EMAIL_CAMPAIGN_SEND,
    { userId: user.id, campaignId },
    {
      jobId: campaignJobId(campaignId),
      delayMs: Math.max(delayMs, 2_000),
    }
  )
  triggerQueueDrainNow({ afterMs: Math.max(delayMs, 2_000) })

  return { ...burst, progress, done: false, nextBurstDelayMs: delayMs }
}
