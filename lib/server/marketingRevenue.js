import { findPipelineEntry } from './pipelineAccess.js'
import { filterMarketingEventsForCampaign } from './marketingEvents.js'

const ATTRIBUTION_WINDOW_MS = 90 * 86400000

function wonDealsForLead(entry, { afterIso } = {}) {
  const deals = entry?.crm?.deals || []
  const after = afterIso ? new Date(afterIso).getTime() : 0
  return deals.filter((d) => {
    if (!d.wonAt) return false
    if (after && new Date(d.wonAt).getTime() < after) return false
    return true
  })
}

function lastClickBeforeWin(events, leadId, wonAt) {
  const winTime = new Date(wonAt).getTime()
  const clicks = events
    .filter((e) => e.type === 'click' && e.leadId === leadId && e.campaignId)
    .filter((e) => new Date(e.createdAt).getTime() <= winTime)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  return clicks[0] || null
}

/**
 * Attribute revenue to campaigns based on last-click before deal won (90-day window).
 */
export function buildCampaignRevenueAttribution(store, user, campaignId, enrollments = []) {
  const events = filterMarketingEventsForCampaign(store, user, campaignId)
  const campaignStart = (store.marketingCampaigns || []).find((c) => c.id === campaignId)?.startedAt

  let attributedRevenue = 0
  let attributedDeals = 0
  const rows = []

  for (const enrollment of enrollments) {
    const entry = findPipelineEntry(store, user, enrollment.leadId)
    if (!entry) continue

    const wins = wonDealsForLead(entry, { afterIso: campaignStart })
    for (const deal of wins) {
      const click = lastClickBeforeWin(events, enrollment.leadId, deal.wonAt)
      if (!click || click.campaignId !== campaignId) continue

      const winTime = new Date(deal.wonAt).getTime()
      const clickTime = new Date(click.createdAt).getTime()
      if (winTime - clickTime > ATTRIBUTION_WINDOW_MS) continue

      const amount = Number(deal.amount) || 0
      attributedRevenue += amount
      attributedDeals += 1
      rows.push({
        leadId: enrollment.leadId,
        dealId: deal.id,
        dealName: deal.name,
        amount,
        currency: deal.currency || entry.crm?.dealCurrency || 'INR',
        wonAt: deal.wonAt,
        clickUrl: click.url || null,
      })
    }
  }

  return {
    attributedRevenue: Math.round(attributedRevenue * 100) / 100,
    attributedDeals,
    currency: rows[0]?.currency || 'INR',
    deals: rows.slice(0, 50),
  }
}

export function orgMarketingRevenueSummary(store, user, campaigns = [], { periodDays = 90 } = {}) {
  const cutoff = Date.now() - periodDays * 86400000
  let revenue = 0
  let deals = 0

  for (const campaign of campaigns) {
    if (campaign.startedAt && new Date(campaign.startedAt).getTime() < cutoff) continue
    const enrollments = (store.marketingEnrollments || []).filter((e) => e.campaignId === campaign.id)
    const attr = buildCampaignRevenueAttribution(store, user, campaign.id, enrollments)
    revenue += attr.attributedRevenue
    deals += attr.attributedDeals
  }

  return { revenue, deals }
}
