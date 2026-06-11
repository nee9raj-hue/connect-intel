import { useEffect } from 'react'
import { createPortal } from 'react-dom'

/** Floating filter panel (desktop) — not full-screen; Esc closes. */
export default function PipelineFilterPopup({
  open,
  title,
  onClose,
  onApply,
  children,
  applyLabel = 'Apply',
  wide = false,
}) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="pipeline-filter-popup-root" role="presentation">
      <button type="button" className="pipeline-filter-popup-backdrop" aria-label="Close" onClick={onClose} />
      <div
        className={`pipeline-filter-popup ${wide ? 'pipeline-filter-popup--wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="pipeline-filter-popup__head">
          <h2 className="pipeline-filter-popup__title">{title}</h2>
          <button type="button" className="pipeline-filter-popup__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="pipeline-filter-popup__body">{children}</div>
        <footer className="pipeline-filter-popup__foot">
          <button type="button" className="crm-filter-link-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="crm-filter-menu-footer-apply" onClick={onApply}>
            {applyLabel}
          </button>
        </footer>
      </div>
    </div>,
    document.body
  )
}
