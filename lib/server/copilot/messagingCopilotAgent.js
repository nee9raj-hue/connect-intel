/**
 * Messaging campaign intelligence for Copilot (pipeline bulk + marketing sends).
 */
import { filterMarketingCampaignsVisible } from '../marketingAccess.js'
import {
  getMessagingCampaignSummary,
  listFailedMessagingRecipients,
  MESSAGING_COPILOT_ACTIONS,
} from '../messaging/copilot.js'

function extractCampaignId(message) {
  const m = String(message || '').match(/\b(mcamp_[a-z0-9]+)\b/i)
  return m ? m[1] : null
}

function findRecentCampaign(store, user) {
  const rows = filterMarketingCampaignsVisible(store.marketingCampaigns || [], user)
  const sorted = [...rows].sort(
    (a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0)
  )
  return sorted[0] || null
}

export async function runMessagingCopilotAgent({ store, user, message, plan }) {
  const text = String(message || '').trim()
  const lower = text.toLowerCase()
  const intents = plan?.intents || {}

  const explicitId = extractCampaignId(text)
  const campaign = explicitId
    ? (store.marketingCampaigns || []).find((c) => c.id === explicitId) || null
    : findRecentCampaign(store, user)

  if (!campaign) {
    return {
      reply:
        '**No campaign found** — run a Pipeline bulk email or Marketing campaign first, then ask for performance or failed sends.',
      source: 'messaging_copilot',
      sources: [{ type: 'crm', label: 'Messaging' }],
      confidence: 'medium',
      suggestions: ['How do bulk emails work?', 'Open Marketing hub'],
      actions: [{ type: 'navigate', panel: 'marketing', label: 'Marketing hub' }],
    }
  }

  const summary = await getMessagingCampaignSummary(user, store, campaign.id)
  if (!summary) {
    return {
      reply: `Campaign **${campaign.name || campaign.id}** exists but send stats are not available yet.`,
      source: 'messaging_copilot',
      sources: [{ type: 'crm', label: 'Messaging' }],
      confidence: 'low',
      suggestions: ['Retry in a minute after send completes'],
      actions: [],
    }
  }

  if (intents.messagingRetry || /\bretry failed\b/i.test(lower)) {
    const failed = await listFailedMessagingRecipients(campaign.id)
    const lines = failed.slice(0, 8).map((r) => `- ${r.email || r.leadId}: ${r.error || 'failed'}`)
    return {
      reply: `**Failed recipients (${failed.length})** for ${campaign.name || 'campaign'}:\n\n${
        lines.length ? lines.join('\n') : '_No failed rows — all sent or still queued._'
      }\n\nUse **Communications** monitor → **Retry failed** on the campaign.`,
      source: 'messaging_copilot',
      sources: [{ type: 'crm', label: 'Campaign' }],
      confidence: 'high',
      suggestions: ['Campaign send summary', 'Draft follow-up for non-openers'],
      actions: [
        { type: 'navigate', panel: 'pipeline', label: 'Open Pipeline' },
        { type: 'navigate', panel: 'marketing', tab: 'campaigns', label: 'Marketing campaigns' },
      ],
    }
  }

  const openRate =
    summary.sent > 0 ? Math.round(((summary.opened || 0) / summary.sent) * 100) : 0
  const clickRate =
    summary.sent > 0 ? Math.round(((summary.clicked || 0) / summary.sent) * 100) : 0

  return {
    reply: `**Campaign:** ${campaign.name || campaign.id}\n\n- **Status:** ${summary.sendStatus || 'unknown'}\n- **Sent:** ${summary.sent} / ${summary.total}\n- **Failed:** ${summary.failed}\n- **Opened:** ${summary.opened} (${openRate}%)\n- **Clicked:** ${summary.clicked} (${clickRate}%)\n- **Remaining:** ${summary.remaining}`,
    source: 'messaging_copilot',
    sources: [{ type: 'crm', label: 'Campaign stats' }],
    confidence: 'high',
    suggestions: [
      'Retry failed sends',
      'Draft follow-up for non-openers',
      'Who needs follow-up today?',
    ],
    actions: [
      { type: 'navigate', panel: 'pipeline', label: 'Pipeline' },
      { type: 'navigate', panel: 'marketing', tab: 'campaigns', label: 'Campaigns' },
    ],
    messagingMeta: { campaignId: campaign.id, verb: MESSAGING_COPILOT_ACTIONS[0] },
  }
}
