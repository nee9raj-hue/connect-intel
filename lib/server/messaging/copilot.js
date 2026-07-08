/**
 * Copilot verbs for messaging campaigns (performance, retry, follow-up drafts).
 */
import { getCampaignSendProgress } from '../email/campaignProgress.js'
import { readCampaignEnrollments } from '../marketingEnrollmentShard.js'

export async function getMessagingCampaignSummary(user, store, campaignId) {
  const progress = await getCampaignSendProgress(campaignId, user, store)
  if (!progress) return null
  return {
    campaignId,
    sendStatus: progress.sendStatus,
    total: progress.total,
    sent: progress.sent,
    failed: progress.failed,
    opened: progress.opened,
    clicked: progress.clicked,
    remaining: progress.remaining,
    responseRate:
      progress.sent > 0 ? Math.round(((progress.opened || 0) / progress.sent) * 100) : 0,
  }
}

export async function listFailedMessagingRecipients(campaignId) {
  const rows = await readCampaignEnrollments(campaignId)
  return rows
    .filter((r) => r.status === 'failed')
    .map((r) => ({
      enrollmentId: r.id,
      leadId: r.leadId,
      email: r.contactEmail,
      error: r.lastError,
    }))
}

export const MESSAGING_COPILOT_ACTIONS = [
  'messaging.campaign_summary',
  'messaging.retry_failed',
  'messaging.draft_followup_non_openers',
  'messaging.draft_followup_opened_no_reply',
]
