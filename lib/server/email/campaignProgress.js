import { readCampaignStatsShard } from '../marketingCampaignStatsShard.js'
import { readEnrollmentMeta } from '../marketingEnrollmentShard.js'
import { filterMarketingEventsForCampaign } from '../marketingEvents.js'
import {
  campaignsV3TableActive,
  readCampaignProgressAggregate,
} from '../campaignsV3Table.js'
import { resolveSendDisplayStatus, isTerminalCampaignStatus } from './campaignLifecycle.js'
import { estimateCompletionMs } from './providerRateLimits.js'

/**
 * Build progress snapshot from campaign_stats SQL aggregates (no enrollment scans).
 */
export function buildProgressFromSqlAggregate(campaignId, aggregate, { statsShard = null, meta = null } = {}) {
  const sqlStats = aggregate?.stats || {}
  const sqlCampaign = aggregate?.campaign || {}

  const queued = sqlStats.queued ?? 0
  const sending = sqlStats.sending ?? 0
  const sent = sqlStats.sent ?? 0
  const failed = sqlStats.failed ?? 0
  const unsubscribed = sqlStats.unsubscribed ?? 0
  const opened = sqlStats.opened ?? statsShard?.uniqueOpens ?? statsShard?.opened ?? 0
  const clicked = sqlStats.clicked ?? statsShard?.uniqueClicks ?? statsShard?.clicked ?? 0

  const enrolled =
    statsShard?.enrolled ??
    meta?.total ??
    queued + sending + sent + failed + unsubscribed

  const dueNow = aggregate?.dueCount ?? 0
  const activeQueued = aggregate?.activeCount ?? Math.max(0, queued + sending)
  const remaining = Math.max(0, enrolled - sent - failed - unsubscribed)
  const provider =
    sqlCampaign.provider || statsShard?.emailProvider || statsShard?.lastSendProvider || 'gmail'

  const sendStatus = resolveSendDisplayStatus(
    {
      id: campaignId,
      status: sqlCampaign.status || statsShard?.status || 'active',
      sendStatus: sqlCampaign.send_status || statsShard?.sendStatus,
      stats: { ...(statsShard || {}), sent, failed, enrolled },
    },
    { pending: activeQueued, due: dueNow }
  )

  const etaMs = estimateCompletionMs(provider, { remaining: activeQueued || remaining })

  return {
    campaignId,
    source: 'campaign_stats',
    sendStatus,
    status: sqlCampaign.status || statsShard?.status || 'active',
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
    pendingSends: dueNow,
    queuedSends: activeQueued,
    done: isTerminalCampaignStatus(sendStatus) || (remaining <= 0 && activeQueued <= 0),
    background: true,
    estimatedCompletionMs: etaMs,
    estimatedCompletionAt: etaMs > 0 ? new Date(Date.now() + etaMs).toISOString() : null,
    updatedAt: sqlStats.updated_at || statsShard?.updatedAt || new Date().toISOString(),
  }
}

/**
 * O(1) campaign progress — prefers campaign_stats SQL; falls back to stats shard + enrollment meta.
 */
export async function getCampaignSendProgress(campaignId, user = null, store = null) {
  if (!campaignId) return null

  const [statsShard, meta, sqlAggregate] = await Promise.all([
    readCampaignStatsShard(campaignId),
    readEnrollmentMeta(campaignId),
    campaignsV3TableActive()
      ? readCampaignProgressAggregate(campaignId).catch(() => null)
      : Promise.resolve(null),
  ])

  if (sqlAggregate?.stats || sqlAggregate?.campaign) {
    const progress = buildProgressFromSqlAggregate(campaignId, sqlAggregate, { statsShard, meta })
    if (user && store && progress.sent > 0 && progress.opened === 0 && progress.clicked === 0) {
      const events = filterMarketingEventsForCampaign(store, user, campaignId)
      const openLeads = new Set()
      const clickLeads = new Set()
      for (const ev of events) {
        if (!ev.leadId) continue
        if (ev.type === 'open') openLeads.add(ev.leadId)
        if (ev.type === 'click') clickLeads.add(ev.leadId)
      }
      if (progress.opened === 0) progress.opened = openLeads.size
      if (progress.clicked === 0) progress.clicked = clickLeads.size
    }
    return progress
  }

  const enrolled = statsShard?.enrolled ?? meta?.total ?? 0
  const sent = statsShard?.sent ?? 0
  const failed = statsShard?.failed ?? 0
  const unsubscribed = statsShard?.unsubscribed ?? 0
  let opened = statsShard?.uniqueOpens ?? statsShard?.opened ?? 0
  let clicked = statsShard?.uniqueClicks ?? statsShard?.clicked ?? 0

  if (user && store && sent > 0 && (opened === 0 || clicked === 0)) {
    const events = filterMarketingEventsForCampaign(store, user, campaignId)
    const openLeads = new Set()
    const clickLeads = new Set()
    for (const ev of events) {
      if (!ev.leadId) continue
      if (ev.type === 'open') openLeads.add(ev.leadId)
      if (ev.type === 'click') clickLeads.add(ev.leadId)
    }
    if (opened === 0) opened = openLeads.size
    if (clicked === 0) clicked = clickLeads.size
  }

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
    source: 'shard',
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
