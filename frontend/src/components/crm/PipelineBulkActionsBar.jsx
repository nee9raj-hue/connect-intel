import { useEffect, useRef, useState } from 'react'
import { MailIcon, MoreHorizontalIcon, PencilIcon, WhatsAppIcon } from '../ui/icons'

function TagIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M3 2.5h6.17L14 7.33v4.34L10.67 14H3.66L2 12.34V3.66L3 2.5zm1.2 1.2v8.6l.86.86h5.41l2.33-2.33V7.9L8.9 4.7H4.2z" />
      <path d="M6.25 6a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5z" />
    </svg>
  )
}

function AssignIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M2 8h8M7 5l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 3v10" strokeLinecap="round" />
    </svg>
  )
}

export default function PipelineBulkActionsBar({
  count,
  canAssign = false,
  busy = false,
  onAssign,
  onEdit,
  onTags,
  onMarkReplied,
  onEmail,
  onWhatsApp,
  emailCount = null,
  phoneCount = null,
  onClear,
  recordLabel = 'lead',
  showAssign = true,
  showEdit = true,
  showEmail = true,
  showWhatsApp = true,
  showMore = true,
}) {
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef(null)

  useEffect(() => {
    if (count < 1) setMoreOpen(false)
  }, [count])

  useEffect(() => {
    if (!moreOpen) return undefined
    const onDoc = (e) => {
      if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [moreOpen])

  if (count < 1) return null

  const noun = count === 1 ? recordLabel : `${recordLabel}s`

  return (
    <div className="pipeline-bulk-hs-bar" role="toolbar" aria-label="Bulk actions">
      <span className="pipeline-bulk-hs-bar__count">
        {count} {noun} selected
      </span>

      <div className="pipeline-bulk-hs-bar__actions">
        {showAssign && canAssign && (
          <button type="button" className="pipeline-bulk-hs-bar__btn" disabled={busy} onClick={onAssign}>
            <AssignIcon className="pipeline-bulk-hs-bar__icon" />
            Assign
          </button>
        )}

        {showEdit && (
          <button type="button" className="pipeline-bulk-hs-bar__btn" disabled={busy} onClick={onEdit}>
            <PencilIcon className="pipeline-bulk-hs-bar__icon" />
            Edit
          </button>
        )}

        {onTags && (
          <button type="button" className="pipeline-bulk-hs-bar__btn" disabled={busy} onClick={onTags}>
            <TagIcon className="pipeline-bulk-hs-bar__icon" />
            Tags
          </button>
        )}

        {showEmail && (
        <button
          type="button"
          className="pipeline-bulk-hs-bar__btn"
          disabled={busy || (emailCount !== null && emailCount < 1)}
          onClick={onEmail}
          title={emailCount === 0 ? 'No selected leads have email' : undefined}
        >
          <MailIcon className="pipeline-bulk-hs-bar__icon" />
          Email{emailCount != null && emailCount > 0 ? ` (${emailCount})` : ''}
        </button>
        )}

        {showWhatsApp && (
        <button
          type="button"
          className="pipeline-bulk-hs-bar__btn"
          disabled={busy || (phoneCount !== null && phoneCount < 1)}
          onClick={onWhatsApp}
          title={phoneCount === 0 ? 'No selected leads have phone' : undefined}
        >
          <WhatsAppIcon className="pipeline-bulk-hs-bar__icon" />
          WhatsApp{phoneCount != null && phoneCount > 0 ? ` (${phoneCount})` : ''}
        </button>
        )}

        {showMore && (
        <div className="pipeline-bulk-hs-bar__more" ref={moreRef}>
          <button
            type="button"
            className="pipeline-bulk-hs-bar__btn"
            disabled={busy}
            aria-expanded={moreOpen}
            aria-haspopup="menu"
            onClick={() => setMoreOpen((v) => !v)}
          >
            <MoreHorizontalIcon className="pipeline-bulk-hs-bar__icon" />
            More
          </button>
          {moreOpen && (
            <div className="pipeline-bulk-hs-menu" role="menu">
              <button
                type="button"
                role="menuitem"
                className="pipeline-bulk-hs-menu__item"
                disabled={busy}
                onClick={() => {
                  setMoreOpen(false)
                  onMarkReplied?.()
                }}
              >
                Mark as replied
              </button>
            </div>
          )}
        </div>
        )}
      </div>

      <span className="pipeline-bulk-hs-bar__spacer" aria-hidden />

      <button
        type="button"
        className="pipeline-bulk-hs-bar__clear"
        disabled={busy}
        onClick={onClear}
        aria-label="Clear selection"
      >
        ×
      </button>
    </div>
  )
}
