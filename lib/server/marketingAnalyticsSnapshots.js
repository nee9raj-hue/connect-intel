import { isMarketingSqlQueueEnabled } from './infra/config.js'
import { isSupabaseEnabled, supabaseRest } from './supabaseClient.js'

const TABLE = 'marketing_analytics_snapshots'
const DEFAULT_PERIOD = 'rolling'

function rate(numerator, denominator) {
  const d = Math.max(0, Number(denominator) || 0)
  const n = Math.max(0, Number(numerator) || 0)
  if (!d) return 0
  return Math.round((n / d) * 10000) / 100
}

function mapRow(row) {
  if (!row) return null
  return {
    organizationId: row.organization_id,
    campaignId: row.campaign_id && row.campaign_id !== '' ? row.campaign_id : null,
    period: row.period || DEFAULT_PERIOD,
    emailsSent: row.emails_sent || 0,
    emailsDelivered: row.emails_delivered || 0,
    opens: row.opens || 0,
    clicks: row.clicks || 0,
    bounces: row.bounces || 0,
    unsubscribes: row.unsubscribes || 0,
    openRate: Number(row.open_rate) || 0,
    clickRate: Number(row.click_rate) || 0,
    bounceRate: Number(row.bounce_rate) || 0,
    updatedAt: row.updated_at,
  }
}

export async function marketingAnalyticsSnapshotsActive() {
  return isMarketingSqlQueueEnabled() && isSupabaseEnabled()
}

export async function readOrgMarketingAnalyticsSnapshot(organizationId, period = DEFAULT_PERIOD) {
  if (!organizationId || !(await marketingAnalyticsSnapshotsActive())) return null
  const rows = await supabaseRest(
    `${TABLE}?organization_id=eq.${encodeURIComponent(organizationId)}&campaign_id=eq.&period=eq.${encodeURIComponent(period)}&limit=1`,
    {},
    { timeoutMs: 8_000, attempts: 2 }
  )
  return mapRow(Array.isArray(rows) ? rows[0] : null)
}

export async function readCampaignAnalyticsSnapshot(organizationId, campaignId, period = DEFAULT_PERIOD) {
  if (!organizationId || !campaignId || !(await marketingAnalyticsSnapshotsActive())) return null
  const rows = await supabaseRest(
    `${TABLE}?organization_id=eq.${encodeURIComponent(organizationId)}&campaign_id=eq.${encodeURIComponent(campaignId)}&period=eq.${encodeURIComponent(period)}&limit=1`,
    {},
    { timeoutMs: 8_000, attempts: 2 }
  )
  return mapRow(Array.isArray(rows) ? rows[0] : null)
}

/** Increment snapshot counters via RPC (atomic, no full-store reads). */
export async function incrementMarketingAnalyticsSnapshot({
  organizationId,
  campaignId = null,
  period = DEFAULT_PERIOD,
  sent = 0,
  delivered = 0,
  opens = 0,
  clicks = 0,
  bounces = 0,
  unsubscribes = 0,
} = {}) {
  if (!organizationId || !(await marketingAnalyticsSnapshotsActive())) return null
  const row = await supabaseRest(
    'rpc/ci_increment_marketing_analytics_snapshot',
    {
      method: 'POST',
      body: JSON.stringify({
        p_organization_id: organizationId,
        p_campaign_id: campaignId,
        p_period: period,
        p_sent: sent,
        p_delivered: delivered,
        p_opens: opens,
        p_clicks: clicks,
        p_bounces: bounces,
        p_unsubscribes: unsubscribes,
      }),
    },
    { timeoutMs: 12_000, attempts: 2 }
  )
  return mapRow(row)
}

/** Map org snapshot row → marketing dashboard KPI shape. */
export function dashboardFromAnalyticsSnapshot(snapshot, extras = {}) {
  if (!snapshot) return null
  const sent = snapshot.emailsSent || 0
  const delivered = snapshot.emailsDelivered || Math.max(0, sent - snapshot.bounces)
  return {
    source: 'marketing_analytics_snapshots',
    kpis: {
      totalContacts: extras.totalContacts ?? 0,
      activeContacts: extras.activeContacts ?? 0,
      campaignsSent: extras.campaignsSent ?? 0,
      emailsSent: sent,
      emailsDelivered: delivered,
      openRate: snapshot.openRate || rate(snapshot.opens, sent),
      clickRate: snapshot.clickRate || rate(snapshot.clicks, sent),
      bounceRate: snapshot.bounceRate || rate(snapshot.bounces, sent),
      unsubscribeRate: extras.unsubscribeRate ?? 0,
      suppressionCount: extras.suppressionCount ?? 0,
      segmentCount: extras.segmentCount ?? 0,
      listCount: extras.listCount ?? 0,
      pendingApprovals: extras.pendingApprovals ?? 0,
      scheduledCount: extras.scheduledCount ?? 0,
    },
    trend: extras.trend || [],
    analyticsTrend: extras.analyticsTrend || [],
    revenue: extras.revenue || { attributed: 0, currency: 'INR' },
    deliverability: {
      sent,
      delivered,
      bounced: snapshot.bounces || 0,
      bounceRate: snapshot.bounceRate || rate(snapshot.bounces, sent),
    },
    campaigns: extras.campaignRows || [],
    snapshotUpdatedAt: snapshot.updatedAt,
  }
}

export function summaryFromAnalyticsSnapshot(snapshot) {
  if (!snapshot) return null
  return {
    totalCampaigns: 0,
    totalEnrolled: 0,
    totalSent: snapshot.emailsSent || 0,
    totalClicks: snapshot.clicks || 0,
    totalOpens: snapshot.opens || 0,
    source: 'marketing_analytics_snapshots',
  }
}
