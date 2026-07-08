import { campaignsV3TableActive, insertCampaignEvent } from '../campaignsV3Table.js'

/** Mirror engagement (open/click/bounce/reply) into campaign_events SQL. */
export function recordCampaignEngagementEvent({
  campaignId,
  recipientId = null,
  eventType,
  metadata = {},
}) {
  if (!campaignsV3TableActive() || !campaignId || !eventType) return
  void insertCampaignEvent({
    campaignId,
    recipientId,
    eventType: String(eventType).slice(0, 40),
    metadata,
  }).catch((err) => {
    console.warn('campaign_events engagement sync:', err?.message || err)
  })
}
