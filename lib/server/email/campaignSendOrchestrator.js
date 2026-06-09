import { processCampaignSendBurst } from '../marketingCampaigns.js'
import { readCampaignSendShard } from '../marketingCampaignSendShard.js'
import { readStore } from '../store.js'
import { isBackgroundEmailEnabled } from '../infra/config.js'
import { enqueueJob } from '../queue/producer.js'
import { JOB_TYPES, QUEUE_NAMES } from '../queue/names.js'
import { setCampaignSendStatus } from './campaignLifecycle.js'
import { getCampaignSendProgress } from './campaignProgress.js'
import { delayBeforeNextBurst } from './providerRateLimits.js'

function campaignJobId(campaignId) {
  return `campaign-send:${campaignId}`
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
      skipDrainTrigger: true,
      delayMs: options.delayMs || 500,
    }
  )

  await setCampaignSendStatus(campaignId, 'preparing')

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
  const sendShard = await readCampaignSendShard(campaignId)
  const metaStore = await readStore({ only: ['marketingCampaigns'] })
  const campaign =
    sendShard ||
    (metaStore.marketingCampaigns || []).find((c) => c.id === campaignId) ||
    null

  if (!campaign) throw new Error('Campaign not found')
  if (['paused', 'stopped', 'archived', 'cancelled'].includes(campaign.status)) {
    return { skipped: true, reason: 'campaign_not_active' }
  }

  await setCampaignSendStatus(campaignId, 'sending')

  const burst = await processCampaignSendBurst(user, campaignId, {
    limit: 8,
    maxMs: 85_000,
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
      skipDrainTrigger: true,
    }
  )

  return { ...burst, progress, done: false, nextBurstDelayMs: delayMs }
}
