import { getCampaignSendProgress } from '../email/campaignProgress.js'

/**
 * Unified messaging analytics for campaigns (per job).
 */
export async function getMessagingJobAnalytics(campaignId, user, store) {
  const progress = await getCampaignSendProgress(campaignId, user, store)
  if (!progress) return null

  const sent = progress.sent || 0
  const failed = progress.failed || 0
  const opened = progress.opened || 0
  const clicked = progress.clicked || 0
  const total = progress.total || progress.enrolled || 0

  return {
    campaignId,
    jobId: campaignId,
    sendStatus: progress.sendStatus,
    total,
    sent,
    failed,
    queued: progress.queued || 0,
    remaining: progress.remaining || 0,
    opened,
    clicked,
    unsubscribed: progress.unsubscribed || 0,
    delivered: sent,
    openRate: sent > 0 ? Math.round((opened / sent) * 1000) / 10 : 0,
    clickRate: sent > 0 ? Math.round((clicked / sent) * 1000) / 10 : 0,
    failureRate: total > 0 ? Math.round((failed / total) * 1000) / 10 : 0,
    responseRate: sent > 0 ? Math.round((clicked / sent) * 1000) / 10 : 0,
    estimatedCompletionAt: progress.estimatedCompletionAt || null,
    updatedAt: progress.updatedAt,
  }
}
