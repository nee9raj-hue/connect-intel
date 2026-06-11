import { filterCampaignRecipients } from '../marketingCampaignRecipientFilter.js'
import { buildCampaignReport } from './marketingCampaignReport.js'
import { readCampaignEnrollments } from './marketingEnrollmentShard.js'

/**
 * Resolve pipeline lead IDs for a campaign engagement slice.
 */
export async function resolveCampaignRecipientLeadIds(store, user, campaignId, filter = 'all') {
  if (!campaignId) return { leadIds: [], count: 0, filter }

  const enrollments = await readCampaignEnrollments(campaignId)
  const report = buildCampaignReport(store, user, campaignId, enrollments)
  if (!report) return { leadIds: [], count: 0, filter, campaignId }

  const leadIds = filterCampaignRecipients(report.recipients, filter)
    .map((r) => r.leadId)
    .filter(Boolean)

  return { leadIds, count: leadIds.length, filter, campaignId, campaignName: report.campaign?.name }
}
