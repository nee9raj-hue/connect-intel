import { filterMarketingCampaignsVisible, filterMarketingRows } from './marketingAccess.js'
import { buildCampaignEngagementFromEvents, rollupEngagementFromEvents } from './marketingAnalytics.js'
import { mergeCampaignStatsShards } from './marketingCampaignStatsShard.js'
import { listPipelineSavedEntries } from './organizations.js'
import { orgMarketingRevenueSummary } from './marketingRevenue.js'
import { buildRollupTrend } from './marketingAnalyticsRollups.js'
import { filterMarketingEventsForMetrics } from './marketingEvents.js'

function leadEntry(leadOrEntry) {
  return leadOrEntry?.lead || leadOrEntry
}

function hasSendableEmail(entry) {
  const email = String(leadEntry(entry)?.email || leadEntry(entry)?.work_email || '')
    .trim()
    .toLowerCase()
  return email.includes('@') && email !== 'n/a' && email !== 'na' && !leadEntry(entry)?.emailBouncedAt
}

function inDateRange(iso, from, to) {
  if (!iso) return false
  const t = new Date(iso).getTime()
  if (from && t < from.getTime()) return false
  if (to && t > to.getTime()) return false
  return true
}

function parsePeriod(period) {
  const now = new Date()
  const to = now
  let from = null
  switch (period) {
    case '7d':
      from = new Date(now.getTime() - 7 * 86400000)
      break
    case '30d':
      from = new Date(now.getTime() - 30 * 86400000)
      break
    case '90d':
      from = new Date(now.getTime() - 90 * 86400000)
      break
    case 'year':
      from = new Date(now.getFullYear(), 0, 1)
      break
    default:
      from = null
  }
  return { from, to }
}

function contactCountsFromLists(store, user) {
  const lists = filterMarketingRows(store.marketingLists || [], user)
  let total = 0
  for (const row of lists) {
    total += row.memberCount ?? (Array.isArray(row.leadIds) ? row.leadIds.length : 0)
  }
  return { totalContacts: total, activeContacts: total }
}

export async function buildMarketingDashboard(store, user, { period = '30d' } = {}) {
  const { from, to } = parsePeriod(period)
  const events = filterMarketingEventsForMetrics(store, user)
  const eventRollups = rollupEngagementFromEvents(events)
  let campaigns = filterMarketingCampaignsVisible(store.marketingCampaigns || [], user)

  if (from) {
    campaigns = campaigns.filter((c) => inDateRange(c.startedAt || c.createdAt, from, to))
  }

  campaigns = await mergeCampaignStatsShards(campaigns)

  let totalContacts = 0
  let activeContacts = 0
  const entries = listPipelineSavedEntries(store, user)
  if (entries.length) {
    for (const e of entries) {
      totalContacts += 1
      if (hasSendableEmail(e)) activeContacts += 1
    }
  } else {
    const fromLists = contactCountsFromLists(store, user)
    totalContacts = fromLists.totalContacts
    activeContacts = fromLists.activeContacts
  }

  const suppressions = filterMarketingRows(store.marketingSuppressions || [], user)
  const segments = filterMarketingRows(store.marketingSegments || [], user)
  const lists = filterMarketingRows(store.marketingLists || [], user)

  let sent = 0
  let delivered = 0
  let opens = 0
  let clicks = 0
  let bounced = 0
  let unsubscribed = 0
  let campaignsSent = 0

  const campaignRows = []
  for (const c of campaigns) {
    const engagement = buildCampaignEngagementFromEvents(c, events, eventRollups)
    const cSent = Math.max(engagement.recipientsSent || 0, engagement.sent || 0)
    sent += cSent
    delivered += Math.max(
      0,
      cSent - (engagement.bounced || 0) - (engagement.failed || 0)
    )
    opens += engagement.uniqueOpens || 0
    clicks += engagement.uniqueClicks || 0
    bounced += engagement.bounced || 0
    unsubscribed += engagement.unsubscribed || 0
    if (['active', 'completed', 'paused', 'stopped'].includes(c.status) && c.startedAt) {
      campaignsSent += 1
    }
    campaignRows.push({
      id: c.id,
      name: c.name,
      status: c.status,
      sent: cSent,
      stats: engagement,
      openRate: engagement.openRate || 0,
      clickRate: engagement.clickRate || 0,
      startedAt: c.startedAt,
    })
  }

  const openRate = sent > 0 ? Math.round((opens / sent) * 100) : 0
  const clickRate = sent > 0 ? Math.round((clicks / sent) * 100) : 0
  const bounceRate = sent > 0 ? Math.round((bounced / sent) * 100) : 0
  const unsubscribeRate = sent > 0 ? Math.round((unsubscribed / sent) * 100) : 0

  const trend = buildTrend(campaigns, events, from, to)
  const analyticsTrend = buildRollupTrend(store, user, { days: period === '7d' ? 7 : period === '90d' ? 90 : 30 })
  const revenue = orgMarketingRevenueSummary(store, user, campaigns, {
    periodDays: period === '7d' ? 7 : period === '90d' ? 90 : period === 'year' ? 365 : 30,
  })
  const recentCampaigns = campaignRows
    .sort((a, b) => new Date(b.startedAt || 0) - new Date(a.startedAt || 0))
    .slice(0, 8)

  const pendingApprovals = campaigns.filter((c) => c.approvalStatus === 'pending').length
  const scheduledCount = campaigns.filter((c) => c.status === 'scheduled').length

  return {
    period,
    kpis: {
      totalContacts,
      activeContacts,
      campaignsSent,
      emailsDelivered: delivered,
      emailsSent: sent,
      openRate,
      clickRate,
      bounceRate,
      unsubscribeRate,
      suppressionCount: suppressions.length,
      segmentCount: segments.length,
      listCount: lists.length,
      pendingApprovals,
      scheduledCount,
    },
    trend,
    analyticsTrend,
    revenue,
    recentCampaigns,
    deliverability: {
      bounceRate,
      suppressionCount: suppressions.length,
      complaints: suppressions.filter((s) => s.reason === 'complaint').length,
    },
  }
}

function buildTrend(campaigns, events, from, to) {
  const buckets = new Map()
  const addBucket = (key) => {
    if (!buckets.has(key)) {
      buckets.set(key, { date: key, sent: 0, opens: 0, clicks: 0 })
    }
    return buckets.get(key)
  }

  for (const c of campaigns) {
    const key = (c.startedAt || c.createdAt || '').slice(0, 10)
    if (!key) continue
    if (from && new Date(key) < from) continue
    const b = addBucket(key)
    b.sent += c.stats?.sent || 0
  }

  for (const ev of events) {
    const key = (ev.createdAt || '').slice(0, 10)
    if (!key) continue
    if (from && new Date(key) < from) continue
    const b = addBucket(key)
    if (ev.type === 'open') b.opens += 1
    if (ev.type === 'click') b.clicks += 1
  }

  return [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-30)
}
