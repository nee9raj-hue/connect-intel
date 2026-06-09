import { readCampaignStatsShard } from '../marketingCampaignStatsShard.js'
import {
  countPendingCampaignEnrollments,
  readCampaignEnrollments,
  readEnrollmentMeta,
} from '../marketingEnrollmentShard.js'
import { countQueuedCampaignEnrollments } from '../marketingCampaigns.js'
import { readStore } from '../store.js'
import { filterMarketingEventsForCampaign } from '../marketingEvents.js'
import { summarizeEnrollmentEngagement } from '../marketingAnalytics.js'
import { resolveSendDisplayStatus, isTerminalCampaignStatus } from './campaignLifecycle.js'
import { estimateCompletionMs } from './providerRateLimits.js'

export async function getCampaignSendProgress(campaignId, user = null) {
  if (!campaignId) return null

  const [statsShard, meta, enrollments, campaignsStore] = await Promise.all([
    readCampaignStatsShard(campaignId),
    readEnrollmentMeta(campaignId),
    readCampaignEnrollments(campaignId).catch(() => []),
    readStore({ only: ['marketingCampaigns', 'marketingEvents', 'users'] }),
  ])

  const campaign = (campaignsStore.marketingCampaigns || []).find((c) => c.id === campaignId) || {
    id: campaignId,
    status: statsShard?.status || 'active',
    stats: statsShard || {},
  }

  const enrolled = statsShard?.enrolled ?? campaign.stats?.enrolled ?? enrollments.length
  const sent = statsShard?.sent ?? campaign.stats?.sent ?? 0
  const failed = statsShard?.failed ?? campaign.stats?.failed ?? 0
  const unsubscribed = statsShard?.unsubscribed ?? campaign.stats?.unsubscribed ?? 0

  const pendingSends = await countPendingCampaignEnrollments(campaignId)
  const queuedSends = await countQueuedCampaignEnrollments(campaignId)
  const dueNow = meta?.dueCount ?? pendingSends
  const activeQueued = meta?.activeCount ?? queuedSends

  const remaining = Math.max(0, enrolled - sent - failed - unsubscribed)
  const provider = campaign.emailProvider || campaign.lastSendProvider || 'gmail'

  const dbUser = user?.id ? (campaignsStore.users || []).find((u) => u.id === user.id) : user
  const events = dbUser
    ? filterMarketingEventsForCampaign(campaignsStore, dbUser, campaignId)
    : []
  const engagement = summarizeEnrollmentEngagement(enrollments, sent, events)

  const sendStatus = resolveSendDisplayStatus(campaign, {
    pending: activeQueued,
    due: dueNow,
  })

  const etaMs = estimateCompletionMs(provider, { remaining: activeQueued || remaining })

  return {
    campaignId,
    sendStatus,
    status: campaign.status,
    total: enrolled,
    enrolled,
    queued: Math.max(0, activeQueued - dueNow),
    sending: dueNow,
    sent,
    opened: engagement.uniqueOpens || 0,
    clicked: engagement.uniqueClicks || 0,
    failed,
    unsubscribed,
    remaining,
    pendingSends,
    queuedSends,
    done: isTerminalCampaignStatus(sendStatus) || (remaining <= 0 && activeQueued <= 0),
    background: true,
    estimatedCompletionMs: etaMs,
    estimatedCompletionAt: etaMs > 0 ? new Date(Date.now() + etaMs).toISOString() : null,
    updatedAt: statsShard?.updatedAt || campaign.updatedAt || new Date().toISOString(),
  }
}
