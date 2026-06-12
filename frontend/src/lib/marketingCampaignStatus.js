/** Campaign list status + analytics labels (merged stats + test sends). */

export function campaignListStatus(campaign) {
  const stats = campaign?.stats || {}
  const sent = Math.max(stats.sent || 0, stats.recipientsSent || 0)
  const enrolled = stats.enrolled || 0
  const testSent = stats.testSent || campaign?.testSendCount || 0
  const base = String(campaign?.status || 'draft').toLowerCase()

  if (base === 'draft' && sent === 0 && enrolled === 0 && testSent > 0) {
    return { key: 'draft', label: 'Draft', hint: 'Test sent' }
  }
  if (base === 'draft' && sent > 0 && enrolled > 0) {
    if (sent + (stats.failed || 0) >= enrolled) {
      return { key: 'completed', label: 'Sent' }
    }
    return { key: 'active', label: 'Sending' }
  }

  if (base === 'completed' || base === 'sent') return { key: 'completed', label: 'Sent' }
  if (base === 'active') return { key: 'active', label: 'Sending' }
  if (base === 'scheduled') return { key: 'scheduled', label: 'Scheduled' }
  if (base === 'paused') return { key: 'paused', label: 'Paused' }
  if (base === 'stopped') return { key: 'stopped', label: 'Stopped' }
  return { key: base, label: base.charAt(0).toUpperCase() + base.slice(1) }
}

export function campaignAnalyticsSummary(campaign) {
  const stats = campaign?.stats || {}
  const sent = Math.max(stats.sent || 0, stats.recipientsSent || 0)
  const testSent = stats.testSent || campaign?.testSendCount || 0
  const enrolled = stats.enrolled || 0

  if (sent > 0) {
    const openRate = stats.openRate ?? campaign?.openRate ?? 0
    const clickRate = stats.clickRate ?? campaign?.clickRate ?? stats.ctr ?? 0
    if (openRate || clickRate) {
      return `${openRate}% opens · ${clickRate}% clicks`
    }
    if (enrolled > 0) {
      return `${sent.toLocaleString()} of ${enrolled.toLocaleString()} sent`
    }
    return `${sent.toLocaleString()} sent`
  }

  if (testSent > 0) {
    const when = campaign?.lastTestSentAt || stats.lastTestSentAt
    if (when) {
      try {
        return `${testSent} test delivered · ${new Date(when).toLocaleDateString()}`
      } catch {
        return `${testSent} test delivered`
      }
    }
    return `${testSent} test delivered`
  }

  return '—'
}
