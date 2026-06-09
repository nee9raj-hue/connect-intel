import { readCampaignStatsShard } from '../marketingCampaignStatsShard.js'
import { readEnrollmentMeta } from '../marketingEnrollmentShard.js'
import { resolveSendDisplayStatus, isTerminalCampaignStatus } from './campaignLifecycle.js'
import { estimateCompletionMs } from './providerRateLimits.js'

/**
 * O(1) campaign progress — stats shard + enrollment meta only (no enrollment row scans).
 */
export async function getCampaignSendProgress(campaignId, user = null) {
  if (!campaignId) return null

  const [statsShard, meta] = await Promise.all([
    readCampaignStatsShard(campaignId),
    readEnrollmentMeta(campaignId),
  ])

  const enrolled = statsShard?.enrolled ?? meta?.total ?? 0
  const sent = statsShard?.sent ?? 0
  const failed = statsShard?.failed ?? 0
  const unsubscribed = statsShard?.unsubscribed ?? 0
  const opened = statsShard?.uniqueOpens ?? statsShard?.opened ?? 0
  const clicked = statsShard?.uniqueClicks ?? statsShard?.clicked ?? 0

  const dueNow = meta?.dueCount ?? 0
  const activeQueued = meta?.activeCount ?? 0
  const pendingSends = dueNow
  const queuedSends = activeQueued

  const remaining = Math.max(0, enrolled - sent - failed - unsubscribed)
  const provider = statsShard?.emailProvider || statsShard?.lastSendProvider || 'gmail'

  const sendStatus = resolveSendDisplayStatus(
    {
      id: campaignId,
      status: statsShard?.status || 'active',
      sendStatus: statsShard?.sendStatus,
      stats: statsShard || {},
    },
    { pending: activeQueued, due: dueNow }
  )

  const etaMs = estimateCompletionMs(provider, { remaining: activeQueued || remaining })

  return {
    campaignId,
    sendStatus,
    status: statsShard?.status || 'active',
    total: enrolled,
    enrolled,
    queued: Math.max(0, activeQueued - dueNow),
    sending: dueNow,
    sent,
    opened,
    clicked,
    failed,
    unsubscribed,
    remaining,
    pendingSends,
    queuedSends,
    done: isTerminalCampaignStatus(sendStatus) || (remaining <= 0 && activeQueued <= 0),
    background: true,
    estimatedCompletionMs: etaMs,
    estimatedCompletionAt: etaMs > 0 ? new Date(Date.now() + etaMs).toISOString() : null,
    updatedAt: statsShard?.updatedAt || new Date().toISOString(),
  }
}
