import { requireUser } from '../auth.js'
import { readStore } from '../store.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { requireMarketingUser } from '../marketingAccess.js'
import { buildOrgUserResponse } from '../organizations.js'
import { buildMarketingDashboard } from '../marketingDashboard.js'
import { buildMarketingHub } from '../marketingHub.js'
import { isMarketingSqlQueueEnabled } from '../infra/config.js'
import {
  dashboardFromAnalyticsSnapshot,
  readOrgMarketingAnalyticsSnapshot,
} from '../marketingAnalyticsSnapshots.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const sessionUser = await requireUser(req, res)
  if (!sessionUser) return

  const check = requireMarketingUser(sessionUser)
  if (!check.ok) return sendJson(res, 401, { error: check.error })

  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const period = String(req.query?.period || '30d').trim()
  const sections = String(req.query?.sections || 'campaigns,audience,revenue,automation,deliverability')
    .split(',')
    .map((s) => s.trim())

  const store = await readStore({
    only: [
      'marketingCampaigns',
      'marketingLists',
      'marketingSegments',
      'marketingEvents',
      'marketingAutomations',
      'marketingAutomationRuns',
      'marketingSuppressions',
      'users',
      'organizations',
      'organizationMemberships',
      'savedLeads',
    ],
  })
  const user = buildOrgUserResponse(store.users.find((u) => u.id === sessionUser.id) || sessionUser, store)

  const hub = await buildMarketingHub(store, user, { period })
  const dashboard = await buildMarketingDashboard(store, user, { period })

  let snapshot = null
  if (isMarketingSqlQueueEnabled() && user.organizationId) {
    snapshot = await readOrgMarketingAnalyticsSnapshot(user.organizationId, period)
  }

  const payload = {
    period,
    insights: hub.insights,
    campaign_stats: {
      emailsSent: hub.kpis?.emailsSent,
      openRate: hub.kpis?.openRate,
      clickRate: hub.kpis?.clickRate,
      campaignsSent: hub.kpis?.campaignsSent,
      trend: hub.trend,
      topCampaigns: hub.topCampaigns,
    },
    growth_chart: hub.analyticsTrend || hub.trend,
    audience_stats: hub.audienceGrowth,
    revenue_attribution: hub.revenue,
    automation_stats: hub.automationHealth,
    deliverability: hub.deliverability || dashboard.deliverability,
    snapshot: snapshot ? dashboardFromAnalyticsSnapshot(snapshot, { kpis: hub.kpis }) : null,
  }

  if (sections.length && !sections.includes('all')) {
    const filtered = { period }
    if (sections.includes('campaigns')) {
      filtered.campaign_stats = payload.campaign_stats
      filtered.insights = payload.insights
    }
    if (sections.includes('audience')) {
      filtered.audience_stats = payload.audience_stats
      filtered.growth_chart = payload.growth_chart
    }
    if (sections.includes('revenue')) filtered.revenue_attribution = payload.revenue_attribution
    if (sections.includes('automation')) filtered.automation_stats = payload.automation_stats
    if (sections.includes('deliverability')) filtered.deliverability = payload.deliverability
    return sendJson(res, 200, filtered)
  }

  return sendJson(res, 200, payload)
}
