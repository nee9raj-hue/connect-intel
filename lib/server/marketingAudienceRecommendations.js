import { listPipelineSavedEntries } from './organizations.js'
import { filterMarketingCampaignsVisible } from './marketingAccess.js'

const LOST_STATUSES = new Set(['lost', 'closed_lost', 'disqualified'])

function daysSince(iso) {
  if (!iso) return 999
  return (Date.now() - new Date(iso).getTime()) / 86400000
}

function followUpCampaignRecent(visibleCampaigns) {
  return visibleCampaigns.some((c) => {
    if (!c.listId && !c.segmentId) return false
    const sent = c.stats?.sent || 0
    return sent > 0 && daysSince(c.updatedAt) < 30
  })
}

function pushFollowUpRecommendation(items, followUpCount, visibleCampaigns) {
  if (followUpCount >= 20 && !followUpCampaignRecent(visibleCampaigns)) {
    items.push({
      id: 'rec-follow-up',
      title: 'Follow up prospects need attention',
      message: `No campaign reached Follow Up stage in 30 days.`,
      detail: `${followUpCount.toLocaleString()} leads in Follow Up`,
      suggestedName: 'Follow Up Prospects',
      filterJson: { status: 'follow_up' },
      audienceType: 'dynamic',
      priority: 90,
    })
  }
}

/**
 * Fast path — uses precomputed pipeline index summary (no full pipeline scan).
 */
export function buildAudienceRecommendationsFromIndex(
  summary,
  store,
  user,
  { campaigns = [], segments = [] } = {}
) {
  const items = []
  const visibleCampaigns = filterMarketingCampaignsVisible(campaigns, user)

  let followUpCount = 0
  for (const row of summary?.byStatus || []) {
    if (row.status === 'follow_up') followUpCount = row.count || 0
  }

  pushFollowUpRecommendation(items, followUpCount, visibleCampaigns)

  const repliedCount = (summary?.byStatus || []).find((r) => r.status === 'replied')?.count || 0
  if (repliedCount >= 30 && !segments.some((s) => s.name?.toLowerCase().includes('replied'))) {
    items.push({
      id: 'rec-replied',
      title: 'Replied leads ready for nurture',
      message: `${repliedCount.toLocaleString()} leads have replied — bundle them for a follow-up campaign.`,
      detail: 'Create audience?',
      suggestedName: 'Replied Leads',
      filterJson: { status: 'replied' },
      audienceType: 'dynamic',
      priority: 65,
    })
  }

  return items.sort((a, b) => b.priority - a.priority).slice(0, 5)
}

/**
 * Full pipeline scan — cron / cache refresh only.
 */
export function buildAudienceRecommendationsFull(store, user, { campaigns = [], segments = [] } = {}) {
  const items = []
  const entries = listPipelineSavedEntries(store, user)
  const visibleCampaigns = filterMarketingCampaignsVisible(campaigns, user)

  const byStatus = new Map()
  const byCountry = new Map()
  let openedNoReply = 0
  let usaInactive = 0

  for (const entry of entries) {
    const lead = entry.lead || entry
    const status = entry.crm?.status || 'new'
    byStatus.set(status, (byStatus.get(status) || 0) + 1)

    const country = String(lead.country || entry.crm?.country || '').trim().toUpperCase()
    if (country) byCountry.set(country, (byCountry.get(country) || 0) + 1)

    const lastActivity = entry.crm?.lastActivityAt || entry.updatedAt
    if (country === 'USA' && daysSince(lastActivity) > 30) usaInactive += 1

    const opened = (entry.crm?.emailOpens || 0) > 0 || entry.crm?.lastEmailOpenedAt
    const replied = status === 'replied' || entry.crm?.repliedAt
    if (opened && !replied && !LOST_STATUSES.has(status)) openedNoReply += 1
  }

  const followUpCount = byStatus.get('follow_up') || 0
  pushFollowUpRecommendation(items, followUpCount, visibleCampaigns)

  if (openedNoReply >= 15) {
    items.push({
      id: 'rec-opened-no-reply',
      title: 'Engaged but quiet',
      message: `${openedNoReply.toLocaleString()} leads opened emails but never replied.`,
      detail: 'Create audience?',
      suggestedName: 'Opened — No Reply',
      filterJson: { engagement: 'opened_no_reply' },
      audienceType: 'dynamic',
      priority: 85,
    })
  }

  if (usaInactive >= 10) {
    items.push({
      id: 'rec-usa-inactive',
      title: 'USA customers going quiet',
      message: `${usaInactive.toLocaleString()} customers from USA have no recent activity.`,
      detail: 'Create audience?',
      suggestedName: 'USA Inactive Customers',
      filterJson: { country: 'USA', lastActivityDays: 30 },
      audienceType: 'dynamic',
      priority: 75,
    })
  }

  const textileCount = entries.filter((e) => {
    const industry = String(e.lead?.industry || e.crm?.industry || '').toLowerCase()
    return industry.includes('textile')
  }).length

  if (textileCount >= 25 && !segments.some((s) => s.name?.toLowerCase().includes('textile'))) {
    items.push({
      id: 'rec-textile',
      title: 'Textile segment opportunity',
      message: 'Bundle textile importers into a reusable audience.',
      detail: `${textileCount} textile-related contacts`,
      suggestedName: 'Textile Importers',
      filterJson: { industry: 'textile' },
      audienceType: 'dynamic',
      priority: 70,
    })
  }

  return items.sort((a, b) => b.priority - a.priority).slice(0, 5)
}

/** @deprecated Use cached or index-based recommendations on GET. */
export function buildAudienceRecommendations(store, user, opts = {}) {
  return buildAudienceRecommendationsFull(store, user, opts)
}
