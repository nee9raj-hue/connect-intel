import { createId, updateStore } from './store.js'
import { marketingCampaignIdsForUser, rowInMarketingScope } from './marketingAccess.js'
import { getPipelineLeadIds } from './organizations.js'
import { bumpEnrollmentEngagement } from './marketingEnrollmentShard.js'
import { applyPipelineEngagementTag } from './pipelineEngagementTags.js'

export async function recordMarketingEvent({
  organizationId,
  createdByUserId,
  campaignId,
  enrollmentId,
  leadId,
  type,
  url,
  abVariantId,
  actorUser = null,
}) {
  const now = new Date().toISOString()
  await updateStore((draft) => {
    draft.marketingEvents = draft.marketingEvents || []
    draft.marketingEvents.push({
      id: createId('mevt'),
      organizationId: organizationId || null,
      createdByUserId: createdByUserId || null,
      campaignId: campaignId || null,
      enrollmentId: enrollmentId || null,
      leadId: leadId || null,
      type,
      url: url ? String(url).slice(0, 500) : null,
      abVariantId: abVariantId || null,
      createdAt: now,
    })
    draft.marketingEvents = draft.marketingEvents.slice(-5000)

    if (enrollmentId) {
      const e = draft.marketingEnrollments.find((x) => x.id === enrollmentId)
      if (e) {
        if (type === 'open') e.openCount = (e.openCount || 0) + 1
        if (type === 'click') e.clickCount = (e.clickCount || 0) + 1
        e.updatedAt = now
      }
    }
    return draft
  })

  if (enrollmentId && campaignId && (type === 'open' || type === 'click')) {
    try {
      await bumpEnrollmentEngagement(campaignId, enrollmentId, { type })
    } catch (err) {
      console.error('enrollment engagement patch failed:', err?.message || err)
    }
  }

  try {
    const { rollupFromMarketingEvent } = await import('./marketingAnalyticsRollups.js')
    await rollupFromMarketingEvent({
      organizationId,
      createdByUserId,
      campaignId,
      type,
      abVariantId,
      createdAt: new Date().toISOString(),
    })
  } catch {
    /* optional rollups */
  }

  if (organizationId && leadId && (type === 'open' || type === 'click')) {
    try {
      await applyPipelineEngagementTag(actorUser || { id: createdByUserId, organizationId }, {
        organizationId,
        leadId,
        type,
      })
    } catch (err) {
      console.error('pipeline engagement tag failed:', err?.message || err)
    }
  }
}

export function filterMarketingEvents(store, user) {
  const visibleLeadIds = getPipelineLeadIds(store, user)
  const campaignIds = marketingCampaignIdsForUser(store, user)
  return (store.marketingEvents || []).filter(
    (ev) =>
      rowInMarketingScope(ev, user) &&
      (!ev.leadId || visibleLeadIds.has(ev.leadId)) &&
      (!ev.campaignId || campaignIds.has(ev.campaignId))
  )
}

/** Campaign-level open/click rollups — no pipeline lead filter (overview/analytics APIs). */
export function filterMarketingEventsForMetrics(store, user) {
  const campaignIds = marketingCampaignIdsForUser(store, user)
  return (store.marketingEvents || []).filter(
    (ev) =>
      rowInMarketingScope(ev, user) && (!ev.campaignId || campaignIds.has(ev.campaignId))
  )
}

/** Campaign-scoped events for reports (no pipeline lead filter — matches detail report). */
export function filterMarketingEventsForCampaign(store, user, campaignId) {
  const campaignIds = marketingCampaignIdsForUser(store, user)
  if (!campaignId || !campaignIds.has(campaignId)) return []
  return (store.marketingEvents || []).filter(
    (ev) => rowInMarketingScope(ev, user) && ev.campaignId === campaignId
  )
}
