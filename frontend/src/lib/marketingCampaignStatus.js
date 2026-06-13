/** Campaign list status + analytics labels (merged stats + test sends). */

export function campaignListStatus(campaign) {
  const stats = campaign?.stats || campaign?.analytics || {}
  const sent = Math.max(stats.sent || 0, stats.recipientsSent || 0)
  const enrolled = stats.enrolled || 0
  const testSent = stats.testSent || campaign?.testSendCount || 0
  const base = String(campaign?.status || 'draft').toLowerCase()

  if (base === 'draft' && sent === 0 && enrolled === 0 && testSent > 0) {
    return { key: 'draft', label: 'Draft', hint: 'Test sent', tone: 'draft' }
  }
  if (sent > 0 && enrolled > 0 && sent + (stats.failed || 0) < enrolled) {
    return { key: 'active', label: 'Sending', tone: 'active' }
  }
  if (sent > 0 || base === 'completed' || base === 'sent') {
    return { key: 'completed', label: 'Sent', tone: 'completed' }
  }
  if (base === 'active') return { key: 'active', label: 'Sending', tone: 'active' }
  if (base === 'scheduled') return { key: 'scheduled', label: 'Scheduled', tone: 'scheduled' }
  if (base === 'paused') return { key: 'paused', label: 'Paused', tone: 'paused' }
  if (base === 'stopped') return { key: 'stopped', label: 'Stopped', tone: 'stopped' }
  return { key: 'draft', label: 'Draft', tone: 'draft' }
}

export function campaignMetrics(campaign) {
  const stats = campaign?.stats || campaign?.analytics || {}
  const sent = Math.max(stats.sent || 0, stats.recipientsSent || 0)
  const testSent = stats.testSent || campaign?.testSendCount || 0
  const enrolled = stats.enrolled || 0
  const opens = Math.max(stats.uniqueOpens || 0, stats.opens || 0)
  const clicks = Math.max(stats.uniqueClicks || 0, stats.clicks || 0)
  let openRate = stats.openRate ?? campaign?.openRate ?? 0
  let clickRate = stats.clickRate ?? campaign?.clickRate ?? stats.ctr ?? 0
  if (sent > 0) {
    if (opens > 0) openRate = Math.round((opens / sent) * 100)
    if (clicks > 0) clickRate = Math.round((clicks / sent) * 100)
  }
  return {
    sent,
    enrolled,
    testSent,
    openRate,
    clickRate,
    opens,
    clicks,
  }
}

export function campaignAnalyticsSummary(campaign) {
  const m = campaignMetrics(campaign)

  if (m.sent > 0) {
    if (m.openRate || m.clickRate) {
      return `${m.openRate}% opens · ${m.clickRate}% clicks`
    }
    if (m.enrolled > 0) {
      return `${m.sent.toLocaleString()} of ${m.enrolled.toLocaleString()} sent`
    }
    return `${m.sent.toLocaleString()} delivered`
  }

  if (m.testSent > 0) {
    const when = campaign?.lastTestSentAt || campaign?.stats?.lastTestSentAt
    if (when) {
      try {
        return `${m.testSent} test · ${new Date(when).toLocaleDateString()}`
      } catch {
        return `${m.testSent} test delivered`
      }
    }
    return `${m.testSent} test delivered`
  }

  return '—'
}

export function campaignSummaryCounts(campaigns = []) {
  const counts = { draft: 0, scheduled: 0, active: 0, sent: 0, test: 0 }
  for (const c of campaigns) {
    const display = campaignListStatus(c)
    const m = campaignMetrics(c)
    if (display.key === 'draft') counts.draft += 1
    else if (display.key === 'scheduled') counts.scheduled += 1
    else if (display.key === 'active') counts.active += 1
    else if (display.key === 'completed') counts.sent += 1
    if (m.testSent > 0) counts.test += 1
  }
  return counts
}
