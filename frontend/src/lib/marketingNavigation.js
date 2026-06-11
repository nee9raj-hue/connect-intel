import { navTargetToOptions } from './navConfig'
import { campaignRecipientFilterLabel } from '../../../lib/marketingCampaignRecipientFilter.js'

/** Navigate from Marketing Hub to pipeline with campaign engagement filter. */
export function marketingPipelineOptions(
  { campaignId, filter = 'all', campaignName, leadIds, returnTo = 'marketing' } = {}
) {
  const opts = {
    panel: 'pipeline',
    returnTo,
    marketingTab: 'analytics',
    campaignId,
    campaignRecipientFilter: filter,
    campaignName: campaignName || undefined,
  }
  if (filter === 'opened') opts.openedCampaignId = campaignId
  if (filter === 'clicked') opts.clickedCampaignId = campaignId
  if (Array.isArray(leadIds) && leadIds.length) opts.leadIds = [...leadIds]
  return { ...navTargetToOptions(opts), ...opts }
}

export function describeMarketingPipelineFilter(panelOptions = {}) {
  const po = panelOptions || {}
  if (!po.campaignId && !po.openedCampaignId && !po.clickedCampaignId && !po.campaignRecipientFilter) {
    return null
  }
  const filter = po.campaignRecipientFilter || (po.openedCampaignId ? 'opened' : po.clickedCampaignId ? 'clicked' : 'all')
  const name = po.campaignName ? `${po.campaignName}: ` : 'Campaign: '
  const label = campaignRecipientFilterLabel(filter)
  if (po.leadIds?.length) return `${name}${label} (${po.leadIds.length} leads)`
  return `${name}${label}`
}
