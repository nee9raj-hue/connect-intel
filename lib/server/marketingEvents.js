import { createId, updateStore } from './store.js'
import { filterMarketingRows, rowInMarketingScope } from './marketingAccess.js'
import { getPipelineLeadIds } from './organizations.js'

export async function recordMarketingEvent({
  organizationId,
  createdByUserId,
  campaignId,
  enrollmentId,
  leadId,
  type,
  url,
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
}

export function filterMarketingEvents(store, user) {
  const visibleLeadIds = getPipelineLeadIds(store, user)
  const campaignIds = new Set(
    filterMarketingRows(store.marketingCampaigns || [], user).map((c) => c.id)
  )
  return (store.marketingEvents || []).filter(
    (ev) =>
      rowInMarketingScope(ev, user) &&
      (!ev.leadId || visibleLeadIds.has(ev.leadId)) &&
      (!ev.campaignId || campaignIds.has(ev.campaignId))
  )
}
