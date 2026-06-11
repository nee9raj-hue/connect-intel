import { filterCampaignRecipients } from '../marketingCampaignRecipientFilter.js'
import { buildCampaignReport } from './marketingCampaignReport.js'
import { filterMarketingEventsForCampaign } from './marketingEvents.js'
import { readCampaignEnrollments } from './marketingEnrollmentShard.js'

async function leadIdsFromEvents(store, user, campaignId, type) {
  const events = filterMarketingEventsForCampaign(store, user, campaignId)
  const ids = new Set()
  for (const ev of events) {
    if (!ev.leadId) continue
    if (type === 'open' && ev.type === 'open') ids.add(ev.leadId)
    if (type === 'click' && ev.type === 'click') ids.add(ev.leadId)
  }
  return [...ids]
}

/**
 * Resolve pipeline lead IDs for a campaign engagement slice.
 */
export async function resolveCampaignRecipientLeadIds(store, user, campaignId, filter = 'all') {
  if (!campaignId) return { leadIds: [], count: 0, filter }

  if (filter === 'opened') {
    const leadIds = await leadIdsFromEvents(store, user, campaignId, 'open')
    return { leadIds, count: leadIds.length, filter, campaignId }
  }
  if (filter === 'clicked') {
    const leadIds = await leadIdsFromEvents(store, user, campaignId, 'click')
    return { leadIds, count: leadIds.length, filter, campaignId }
  }

  const enrollments = await readCampaignEnrollments(campaignId)
  const report = buildCampaignReport(store, user, campaignId, enrollments)
  if (!report) return { leadIds: [], count: 0, filter, campaignId }

  const leadIds = filterCampaignRecipients(report.recipients, filter)
    .map((r) => r.leadId)
    .filter(Boolean)

  return { leadIds, count: leadIds.length, filter, campaignId, campaignName: report.campaign?.name }
}
