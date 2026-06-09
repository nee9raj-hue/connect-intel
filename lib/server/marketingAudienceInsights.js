import { listPipelineSavedEntries } from './organizations.js'
import { snapshotLeadIds } from './marketingAudienceSnapshots.js'
import { getMarketingSegment } from './marketingSegments.js'
import { getMarketingList } from './marketingCampaigns.js'

function entryLeadId(entry) {
  return entry?.leadId || entry?.lead?.id || entry?.id
}

function topBuckets(map, limit = 6) {
  return Object.entries(map)
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

/**
 * Aggregate stage / owner / country breakdown for snapshot lead ids only.
 * Scans pipeline entries once — use on audience detail, not studio list load.
 */
export function computeAudienceInsights(store, user, leadIds) {
  const idSet = new Set((leadIds || []).filter(Boolean))
  if (!idSet.size) {
    return { byStage: [], byOwner: [], byCountry: [], sampleSize: 0 }
  }

  const byStage = {}
  const byOwner = {}
  const byCountry = {}
  let matched = 0

  for (const entry of listPipelineSavedEntries(store, user)) {
    const id = entryLeadId(entry)
    if (!idSet.has(id)) continue
    matched += 1

    const status = entry.crm?.status || 'new'
    byStage[status] = (byStage[status] || 0) + 1

    const owner = entry.assignedToUserId || entry.savedByUserId || '__unassigned__'
    byOwner[owner] = (byOwner[owner] || 0) + 1

    const country = String(entry.lead?.country || entry.crm?.country || '').trim() || 'Unknown'
    byCountry[country] = (byCountry[country] || 0) + 1
  }

  return {
    sampleSize: matched,
    byStage: topBuckets(byStage).map(({ key, count }) => ({ status: key, count })),
    byOwner: topBuckets(byOwner).map(({ key, count }) => ({ ownerId: key, count })),
    byCountry: topBuckets(byCountry).map(({ key, count }) => ({ country: key, count })),
  }
}

export function insightsForAudienceEntity(store, user, entity, sourceType) {
  const leadIds = snapshotLeadIds(entity)
  const insights = computeAudienceInsights(store, user, leadIds)
  const metrics = entity?.snapshot || {}
  return {
    ...insights,
    engagedCount: metrics.engagedCount,
    deliverableCount: metrics.deliverableCount ?? metrics.contactCount ?? leadIds.length,
  }
}

export function resolveAudienceEntity(store, user, { listId, segmentId, audienceId }) {
  if (segmentId || (audienceId && String(audienceId).startsWith('mseg'))) {
    const id = segmentId || audienceId
    const segment = getMarketingSegment(store, user, id)
    if (!segment) return null
    return { entity: segment, sourceType: 'segment' }
  }
  const id = listId || audienceId
  const list = getMarketingList(store, user, id)
  if (!list) return null
  return { entity: list, sourceType: 'list' }
}
