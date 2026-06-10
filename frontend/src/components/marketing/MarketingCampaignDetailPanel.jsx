import { formatDateTime } from '../../lib/crmUiConstants'
import { formatDealValue } from '../../lib/crmTimeline'
import { renderEmailCanvasHtml } from '../../lib/marketingEmailDesign'
import { CAMPAIGN_STATUS } from './marketingTheme'

export default function MarketingCampaignDetailPanel({ campaign, onClose, onEdit, onNavigate }) {
  if (!campaign) return null
  const stats = campaign.stats || {}
  const statusKey = String(campaign.status || 'draft').toLowerCase()
  const badge = CAMPAIGN_STATUS[statusKey] || CAMPAIGN_STATUS.draft
  const previewHtml = campaign.blocks?.length
    ? renderEmailCanvasHtml(campaign.blocks, campaign.design || {}, { preview: true })
    : null

  return (
    <div className="mhub-v3-detail-overlay" role="dialog" aria-modal="true">
      <div className="mhub-v3-detail-panel">
        <header className="mhub-v3-detail-panel__head">
          <button type="button" className="mhub-v3-back" onClick={onClose} aria-label="Close">
            ×
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>{campaign.name}</h2>
            <p style={{ fontSize: 11, color: '#999', margin: '4px 0 0' }}>
              <span className="mhub-v3-badge" style={{ background: badge.bg, color: badge.color }}>
                {badge.label}
              </span>
              {campaign.startedAt ? ` · Sent ${formatDateTime(campaign.startedAt)}` : ''}
            </p>
          </div>
          <button type="button" className="mhub-v3-btn" onClick={() => onEdit?.(campaign)}>
            Edit
          </button>
        </header>

        <div className="mhub-v3-detail-panel__stats">
          <div><strong>{stats.openRate || 0}%</strong><span>Opens</span></div>
          <div><strong>{stats.clickRate || 0}%</strong><span>Clicks</span></div>
          <div><strong>{stats.revenue ? formatDealValue(stats.revenue) : '—'}</strong><span>Revenue</span></div>
          <div><strong>{stats.sent || 0}</strong><span>Sent</span></div>
        </div>

        <div className="mhub-v3-detail-panel__body">
          <p className="mhub-v3-eyebrow">Overview</p>
          <dl className="mhub-v3-detail-dl">
            <dt>Subject</dt>
            <dd>{campaign.subject || '—'}</dd>
            <dt>From</dt>
            <dd>{campaign.fromEmail || campaign.senderEmail || '—'}</dd>
            <dt>Audience</dt>
            <dd>{campaign.listName || campaign.segmentName || '—'}</dd>
            <dt>Sent</dt>
            <dd>{campaign.startedAt ? formatDateTime(campaign.startedAt) : '—'}</dd>
          </dl>

          {previewHtml ? (
            <div
              className="mhub-v3-email-preview"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          ) : (
            <div className="mhub-v3-email-preview mhub-v3-email-preview--empty">
              {campaign.name?.slice(0, 1) || 'C'}
            </div>
          )}

          <button
            type="button"
            className="mhub-v3-link"
            style={{ marginTop: 12 }}
            onClick={() => onNavigate?.('marketing', { tab: 'analytics', campaignId: campaign.id })}
          >
            View full report →
          </button>
        </div>
      </div>
    </div>
  )
}
