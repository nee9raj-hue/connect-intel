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
  floating = false,
  onAssign,
  onEdit,
  onTags,
  onMarkReplied,
  onEmail,
  onCreateBatchLists,
  onWhatsApp,
  emailCount = null,
  emailDisabled = false,
  emailDisabledTitle = null,
  phoneCount = null,
  onClear,
  recordLabel = 'lead',
  showAssign = true,
  showEdit = true,
  showEmail = true,
  showWhatsApp = true,
  showMore = true,
  onExport,
  onDelete,
}) {
  const [moreOpen, setMoreOpen] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)
  const moreRef = useRef(null)
  const emailRef = useRef(null)

  useEffect(() => {
    if (count < 1) {
      setMoreOpen(false)
      setEmailOpen(false)
    }
  }, [count])

  useEffect(() => {
    if (!moreOpen && !emailOpen) return undefined
    const onDoc = (e) => {
      if (moreOpen && moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false)
      if (emailOpen && emailRef.current && !emailRef.current.contains(e.target)) setEmailOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [moreOpen, emailOpen])

  if (count < 1) return null

  const noun = count === 1 ? recordLabel : `${recordLabel}s`
  const rootClass = floating ? 'pipeline-bulk-floating' : 'pipeline-bulk-hs-bar'

  return (
    <div className={rootClass} role="toolbar" aria-label="Bulk actions">
      <span className={floating ? 'pipeline-bulk-floating__count' : 'pipeline-bulk-hs-bar__count'}>
        {floating ? <span className="pipeline-bulk-floating__dot" aria-hidden /> : null}
        {count} {noun} selected
      </span>

      <div className={floating ? 'pipeline-bulk-floating__actions' : 'pipeline-bulk-hs-bar__actions'}>
        {showAssign && canAssign && (
          <button
            type="button"
            className={floating ? 'pipeline-bulk-floating__btn' : 'pipeline-bulk-hs-bar__btn'}
            disabled={busy}
            onClick={onAssign}
          >
            <AssignIcon className="pipeline-bulk-hs-bar__icon" />
            Assign owner
          </button>
        )}
        {showEdit && (
          <button
            type="button"
            className={floating ? 'pipeline-bulk-floating__btn' : 'pipeline-bulk-hs-bar__btn'}
            disabled={busy}
            onClick={onEdit}
          >
            <PencilIcon className="pipeline-bulk-hs-bar__icon" />
            Change status
          </button>
        )}
        {onTags && (
          <button
            type="button"
            className={floating ? 'pipeline-bulk-floating__btn' : 'pipeline-bulk-hs-bar__btn'}
            disabled={busy}
            onClick={onTags}
          >
            <TagIcon className="pipeline-bulk-hs-bar__icon" />
            Add tag
          </button>
        )}
        {showEmail && onEmail && (
          <div className="relative" ref={emailRef}>
            <button
              type="button"
              className={floating ? 'pipeline-bulk-floating__btn' : 'pipeline-bulk-hs-bar__btn'}
              disabled={busy || emailDisabled}
              title={emailDisabledTitle || undefined}
              onClick={() => setEmailOpen((v) => !v)}
            >
              <MailIcon className="pipeline-bulk-hs-bar__icon" />
              Email
              {emailCount != null ? ` (${emailCount})` : ''}
            </button>
            {emailOpen && (
              <div className="pipeline-bulk-hs-menu">
                <button type="button" className="pipeline-bulk-hs-menu__item" onClick={() => { setEmailOpen(false); onEmail() }}>
                  Send email
                </button>
                {onCreateBatchLists ? (
                  <button type="button" className="pipeline-bulk-hs-menu__item" onClick={() => { setEmailOpen(false); onCreateBatchLists() }}>
                    Create batch lists
                  </button>
                ) : null}
              </div>
            )}
          </div>
        )}
        {showWhatsApp && onWhatsApp && (
          <button
            type="button"
            className={floating ? 'pipeline-bulk-floating__btn' : 'pipeline-bulk-hs-bar__btn'}
            disabled={busy}
            onClick={onWhatsApp}
          >
            <WhatsAppIcon className="pipeline-bulk-hs-bar__icon" />
            WhatsApp
            {phoneCount != null ? ` (${phoneCount})` : ''}
          </button>
        )}
        {floating && onExport && (
          <button
            type="button"
            className="pipeline-bulk-floating__btn"
            disabled={busy}
            onClick={onExport}
          >
            Export CSV
          </button>
        )}
        {floating && onDelete && (
          <button
            type="button"
            className="pipeline-bulk-floating__btn pipeline-bulk-floating__btn--danger"
            disabled={busy}
            onClick={onDelete}
          >
            Delete
          </button>
        )}
        {showMore && (onMarkReplied || onExport || onDelete) && (
          <div className="relative" ref={moreRef}>
            <button
              type="button"
              className={floating ? 'pipeline-bulk-floating__btn' : 'pipeline-bulk-hs-bar__btn'}
              disabled={busy}
              onClick={() => setMoreOpen((v) => !v)}
            >
              <MoreHorizontalIcon className="pipeline-bulk-hs-bar__icon" />
              More
            </button>
            {moreOpen && (
              <div className="pipeline-bulk-hs-menu">
                {onMarkReplied ? (
                  <button
                    type="button"
                    className="pipeline-bulk-hs-menu__item"
                    onClick={() => {
                      setMoreOpen(false)
                      onMarkReplied()
                    }}
                  >
                    Mark as replied
                  </button>
                ) : null}
                {!floating && onExport ? (
                  <button
                    type="button"
                    className="pipeline-bulk-hs-menu__item"
                    onClick={() => {
                      setMoreOpen(false)
                      onExport()
                    }}
                  >
                    Export CSV
                  </button>
                ) : null}
                {!floating && onDelete ? (
                  <button
                    type="button"
                    className="pipeline-bulk-hs-menu__item"
                    onClick={() => {
                      setMoreOpen(false)
                      onDelete()
                    }}
                  >
                    Remove from pipeline
                  </button>
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>

      {!floating ? <span className="pipeline-bulk-hs-bar__spacer" aria-hidden /> : null}

      <button
        type="button"
        className={floating ? 'pipeline-bulk-floating__clear' : 'pipeline-bulk-hs-bar__clear'}
        onClick={onClear}
        aria-label="Clear selection"
      >
        {floating ? '× Clear selection' : '×'}
      </button>
    </div>
  )
}
