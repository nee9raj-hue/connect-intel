/** Shared campaign recipient engagement filters (reports + pipeline drill-down). */

export const CAMPAIGN_RECIPIENT_FILTERS = [
  { id: 'all', label: 'All recipients' },
  { id: 'sent', label: 'Sent' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'opened', label: 'Opened' },
  { id: 'clicked', label: 'Clicked' },
  { id: 'bounced', label: 'Bounced' },
  { id: 'failed', label: 'Failed' },
  { id: 'unsubscribed', label: 'Unsubscribed' },
  { id: 'pending', label: 'Pending' },
]

export function filterCampaignRecipients(rows, filter) {
  if (!filter || filter === 'all') return rows || []
  if (filter === 'sent') {
    return (rows || []).filter((r) => (r.sentCount || 0) > 0 || r.deliveryStatus === 'delivered')
  }
  if (filter === 'delivered') return (rows || []).filter((r) => r.deliveryStatus === 'delivered')
  if (filter === 'pending') {
    return (rows || []).filter((r) => r.deliveryStatus === 'pending' || (r.sentCount || 0) === 0)
  }
  if (filter === 'opened') return (rows || []).filter((r) => r.opens > 0)
  if (filter === 'clicked') return (rows || []).filter((r) => r.clicks > 0)
  if (filter === 'bounced') return (rows || []).filter((r) => r.deliveryStatus === 'bounced')
  if (filter === 'failed') {
    return (rows || []).filter(
      (r) => r.deliveryStatus === 'failed' || r.deliveryStatus === 'unsubscribed'
    )
  }
  if (filter === 'unsubscribed') return (rows || []).filter((r) => r.deliveryStatus === 'unsubscribed')
  return rows || []
}

export function campaignRecipientFilterLabel(filter) {
  if (filter === 'pending') return 'Pending'
  return CAMPAIGN_RECIPIENT_FILTERS.find((f) => f.id === filter)?.label || 'Campaign recipients'
}
