import { mc } from '../../lib/marketingColors'
import {
  audienceCount,
  audienceLabel,
  stepSummary,
} from '../../lib/marketingCampaignChecklist'

export default function MarketingSendConfirmModal({
  open,
  onClose,
  onConfirm,
  campaignForm,
  lists,
  segments,
  gmailStatus,
  busy,
}) {
  if (!open) return null

  const to = audienceLabel(campaignForm, lists, segments)
  const count = audienceCount(campaignForm, lists, segments)
  const from = stepSummary('from', campaignForm, lists, segments, { gmailStatus })
  const sendTime =
    campaignForm.sendMode === 'scheduled' && campaignForm.scheduledAt
      ? `Scheduled · ${new Date(campaignForm.scheduledAt).toLocaleString()}`
      : 'Now'
  const hasContent = Boolean(campaignForm.blocks?.length || campaignForm.body?.trim())

  return (
    <div className="mc-modal" role="dialog" aria-modal="true">
      <div className="mc-modal__backdrop" onClick={onClose} />
      <div className="mc-modal__card mc-send-confirm">
        <h2>Ready to send?</h2>
        <ul className="mc-send-confirm__list">
          <li>
            <span className="mc-send-confirm__check">✓</span>
            <span>
              <strong>To:</strong> {to || 'Audience'}
              {count > 0 ? ` (${count.toLocaleString()} contacts)` : ''}
            </span>
          </li>
          <li>
            <span className="mc-send-confirm__check">✓</span>
            <span>
              <strong>From:</strong> {from || '—'}
            </span>
          </li>
          <li>
            <span className="mc-send-confirm__check">✓</span>
            <span>
              <strong>Subject:</strong> {campaignForm.subject || '—'}
            </span>
          </li>
          <li>
            <span className="mc-send-confirm__check">✓</span>
            <span>
              <strong>Send time:</strong> {sendTime}
            </span>
          </li>
          <li>
            <span className="mc-send-confirm__check">✓</span>
            <span>
              <strong>Content:</strong> {hasContent ? 'Ready' : 'Missing'}
            </span>
          </li>
        </ul>
        {count > 0 && (
          <p className="mc-send-confirm__estimate" style={{ color: mc.textMuted }}>
            Estimated delivery time: ~{Math.max(1, Math.ceil(count / 200))} minutes
          </p>
        )}
        <footer className="mc-send-confirm__foot">
          <button type="button" className="mc-btn mc-btn--ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="mc-btn mc-btn--primary"
            onClick={onConfirm}
            disabled={busy || !hasContent}
          >
            Send now →
          </button>
        </footer>
      </div>
    </div>
  )
}
