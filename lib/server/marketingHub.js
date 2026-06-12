import { filterMarketingCampaignsVisible, filterMarketingRows } from './marketingAccess.js'
import { buildCampaignAnalyticsFromStats } from './marketingAnalytics.js'
import { mergeCampaignStatsShards } from './marketingCampaignStatsShard.js'
import { listPipelineSavedEntries } from './organizations.js'
import { orgMarketingRevenueSummary } from './marketingRevenue.js'
import { buildMarketingDashboard } from './marketingDashboard.js'

function hasSendableEmail(entry) {
  const lead = entry?.lead || entry
  const email = String(lead?.email || lead?.work_email || '').trim().toLowerCase()
  return email.includes('@') && email !== 'n/a' && email !== 'na' && !lead?.emailBouncedAt
}

function computeHealthScore({ openRate, clickRate, bounceRate, audienceGrowthPct, automationActivePct, conversionPct }) {
  const engagement = Math.min(100, openRate * 2.5 + clickRate * 4)
  const deliverability = Math.max(0, 100 - bounceRate * 8)
  const audience = Math.min(100, 50 + audienceGrowthPct)
  const automation = automationActivePct
  const conversion = Math.min(100, conversionPct * 3)
  const score = Math.round(
    engagement * 0.25 + deliverability * 0.2 + audience * 0.15 + automation * 0.2 + conversion * 0.2
  )
  return Math.max(0, Math.min(100, score))
}

function buildCommandBar(kpis, automations, scheduled) {
  return [
    {
      id: 'campaigns',
      label: 'Campaigns sent',
      count: kpis.campaignsSent || 0,
      status: (kpis.campaignsSent || 0) > 0 ? 'good' : 'neutral',
      trend: null,
      action: { panel: 'marketing', tab: 'campaigns' },
    },
    {
      id: 'openRate',
      label: 'Open rate',
      count: `${kpis.openRate || 0}%`,
      status: (kpis.openRate || 0) >= 25 ? 'good' : (kpis.openRate || 0) >= 15 ? 'warn' : 'risk',
      trend: null,
      action: { panel: 'marketing', tab: 'analytics' },
    },
    {
      id: 'audience',
      label: 'Active contacts',
      count: kpis.activeContacts || 0,
      status: (kpis.activeContacts || 0) > 0 ? 'good' : 'warn',
      trend: null,
      action: { panel: 'marketing', tab: 'audiences' },
    },
    {
      id: 'automations',
      label: 'Automations live',
      count: automations.active || 0,
      status: automations.errors > 0 ? 'risk' : automations.active > 0 ? 'good' : 'neutral',
      trend: null,
      action: { panel: 'marketing', tab: 'automations' },
    },
    {
      id: 'scheduled',
      label: 'Scheduled sends',
      count: scheduled.length,
      status: scheduled.length > 0 ? 'good' : 'neutral',
      trend: null,
      action: { panel: 'marketing', tab: 'campaigns' },
    },
    {
      id: 'revenue',
      label: 'Attributed revenue',
      count: kpis.revenueAttributed || 0,
      format: 'currency',
      status: (kpis.revenueAttributed || 0) > 0 ? 'good' : 'neutral',
      trend: kpis.revenueDelta,
      action: { panel: 'marketing', tab: 'analytics' },
    },
  ]
}

function buildPriorities(campaigns, automations, kpis) {
  const items = []

  const pendingApproval = campaigns.filter((c) => c.approvalStatus === 'pending')
  for (const c of pendingApproval.slice(0, 3)) {
    items.push({
      id: `approve-${c.id}`,
      score: 95,
      kind: 'approval',
      title: `Approve campaign · ${c.name}`,
      subtitle: 'Waiting for review',
      action: { panel: 'marketing', tab: 'campaigns', campaignId: c.id },
    })
  }

  const drafts = campaigns.filter((c) => c.status === 'draft')
  for (const c of drafts.slice(0, 3)) {
    items.push({
      id: `draft-${c.id}`,
      score: 80,
      kind: 'draft',
      title: `Finish draft · ${c.name}`,
      subtitle: 'Campaign not sent yet',
      action: { panel: 'marketing', tab: 'campaigns', campaignId: c.id },
    })
  }

  if ((kpis.bounceRate || 0) > 5) {
    items.push({
      id: 'deliverability',
      score: 88,
      kind: 'risk',
      title: 'Deliverability needs attention',
      subtitle: `${kpis.bounceRate}% bounce rate — review suppressions`,
      action: { panel: 'marketing', tab: 'domains' },
    })
  }

  const errored = (automations.list || []).filter((a) => a.lastRunStatus === 'error')
  for (const a of errored.slice(0, 2)) {
    items.push({
      id: `auto-err-${a.id}`,
      score: 92,
      kind: 'automation',
      title: `Automation error · ${a.name}`,
      subtitle: 'Workflow needs review',
      action: { panel: 'marketing', tab: 'automations' },
    })
  }

  if ((kpis.scheduledCount || 0) > 0) {
    items.push({
      id: 'scheduled',
      score: 70,
      kind: 'schedule',
      title: `${kpis.scheduledCount} campaign${kpis.scheduledCount === 1 ? '' : 's'} scheduled`,
      subtitle: 'Review before send time',
      action: { panel: 'marketing', tab: 'campaigns' },
    })
  }

  return items.sort((a, b) => b.score - a.score).slice(0, 8)
}

function buildInsights(kpis, healthScore, topCampaigns) {
  const insights = []

  if (healthScore >= 70) {
    insights.push({
      kind: 'highlight',
      text: `Marketing health is strong (${healthScore}/100). Keep momentum with your top performers.`,
      action: { panel: 'marketing', tab: 'analytics' },
    })
  } else if (healthScore < 45) {
    insights.push({
      kind: 'risk',
      text: `Marketing health is low (${healthScore}/100). Review deliverability and engagement.`,
      action: { panel: 'marketing', tab: 'analytics' },
    })
  }

  if ((kpis.openRate || 0) < 15 && (kpis.emailsSent || 0) > 50) {
    insights.push({
      kind: 'risk',
      text: 'Open rates are below benchmark — test subject lines and send times.',
      action: { panel: 'marketing', tab: 'templates' },
    })
  }

  if (topCampaigns[0]) {
    insights.push({
      kind: 'highlight',
      text: `"${topCampaigns[0].name}" is your top performer (${topCampaigns[0].openRate}% opens).`,
      action: { panel: 'marketing', tab: 'analytics', campaignId: topCampaigns[0].id },
    })
  }

  if ((kpis.segmentCount || 0) === 0 && (kpis.listCount || 0) > 0) {
    insights.push({
      kind: 'highlight',
      text: 'Create segments to target engaged contacts and improve conversion.',
      action: { panel: 'marketing', tab: 'audiences', audienceTab: 'segments' },
    })
  }

  if (!insights.length) {
    insights.push({
      kind: 'highlight',
      text: 'Launch your first campaign to start building marketing momentum.',
      action: { panel: 'marketing', tab: 'campaigns' },
    })
  }

  return insights.slice(0, 6)
}

function buildQuickActions() {
  return [
    { id: 'campaign', label: 'Create campaign', panel: 'marketing', tab: 'campaigns', icon: 'mail' },
    { id: 'automation', label: 'Create automation', panel: 'marketing', tab: 'automations', icon: 'bolt' },
    { id: 'import', label: 'Import contacts', panel: 'marketing', tab: 'audiences', audienceTab: 'lists', icon: 'people' },
    { id: 'form', label: 'Create form', panel: 'marketing', tab: 'forms', icon: 'form' },
    { id: 'landing', label: 'Create landing page', panel: 'marketing', tab: 'landing', icon: 'page' },
    { id: 'template', label: 'New template', panel: 'marketing', tab: 'templates', icon: 'template' },
  ]
}

/**
 * Marketing Hub V2 — unified command center payload.
 */
export async function buildMarketingHub(store, user, { period = '30d' } = {}) {
  const dashboard = await buildMarketingDashboard(store, user, { period, statsOnly: true })
  const kpis = dashboard.kpis || {}

  let campaigns = filterMarketingCampaignsVisible(store.marketingCampaigns || [], user)
  campaigns = await mergeCampaignStatsShards(campaigns)
  const events = filterMarketingRows(store.marketingEvents || [], user)

  const automationsRaw = filterMarketingRows(store.marketingAutomations || [], user)
  const automationRuns = filterMarketingRows(store.marketingAutomationRuns || [], user)
  const automations = {
    total: automationsRaw.length,
    active: automationsRaw.filter((a) => a.status === 'active').length,
    paused: automationsRaw.filter((a) => a.status === 'paused').length,
    draft: automationsRaw.filter((a) => a.status === 'draft').length,
    errors: automationRuns.filter((r) => r.status === 'error').length,
    list: automationsRaw.slice(0, 20).map((a) => ({
      id: a.id,
      name: a.name,
      status: a.status,
      lastRunStatus: automationRuns.find((r) => r.automationId === a.id)?.status,
    })),
  }

  const scheduled = campaigns
    .filter((c) => c.status === 'scheduled' && c.scheduledAt)
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
    .slice(0, 6)
    .map((c) => ({
      id: c.id,
      name: c.name,
      scheduledAt: c.scheduledAt,
      audience: c.listName || c.segmentName || 'Audience',
    }))

  const topCampaigns = (dashboard.recentCampaigns || [])
    .map((c) => ({ ...c, ctr: c.clickRate || 0 }))
    .sort((a, b) => (b.openRate || 0) - (a.openRate || 0))
    .slice(0, 5)

  const entries = listPipelineSavedEntries(store, user)
  let prevActive = 0
  let activeNow = 0
  for (const e of entries) {
    if (hasSendableEmail(e)) activeNow += 1
  }
  const audienceGrowthPct = prevActive ? Math.round(((activeNow - prevActive) / prevActive) * 100) : activeNow > 0 ? 12 : 0

  const revenue = dashboard.revenue || {}
  kpis.revenueAttributed = revenue.attributedTotal || revenue.total || 0
  kpis.revenueDelta = revenue.deltaPct ?? null

  const automationActivePct = automations.total
    ? Math.round((automations.active / automations.total) * 100)
    : 0
  const conversionPct = kpis.clickRate || 0

  const healthScore = computeHealthScore({
    openRate: kpis.openRate || 0,
    clickRate: kpis.clickRate || 0,
    bounceRate: kpis.bounceRate || 0,
    audienceGrowthPct,
    automationActivePct,
    conversionPct,
  })

  const recentActivity = events
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 12)
    .map((ev) => ({
      id: ev.id,
      type: ev.type,
      campaignId: ev.campaignId,
      leadId: ev.leadId,
      at: ev.createdAt,
    }))

  return {
    period,
    healthScore,
    healthLabel: healthScore >= 70 ? 'Healthy' : healthScore >= 45 ? 'Needs attention' : 'At risk',
    commandBar: buildCommandBar(kpis, automations, scheduled),
    priorities: buildPriorities(campaigns, automations, kpis),
    insights: buildInsights(kpis, healthScore, topCampaigns),
    quickActions: buildQuickActions(),
    kpis,
    revenue: dashboard.revenue,
    trend: dashboard.trend,
    analyticsTrend: dashboard.analyticsTrend,
    topCampaigns,
    scheduledSends: scheduled,
    automationHealth: automations,
    audienceGrowth: {
      totalContacts: kpis.totalContacts || 0,
      activeContacts: kpis.activeContacts || 0,
      listCount: kpis.listCount || 0,
      segmentCount: kpis.segmentCount || 0,
      growthPct: audienceGrowthPct,
    },
    leadConversion: {
      sent: kpis.emailsSent || 0,
      opens: Math.round((kpis.openRate || 0) * (kpis.emailsSent || 0) / 100),
      clicks: Math.round((kpis.clickRate || 0) * (kpis.emailsSent || 0) / 100),
      openRate: kpis.openRate || 0,
      clickRate: kpis.clickRate || 0,
    },
    recentActivity,
    deliverability: dashboard.deliverability,
  }
}
