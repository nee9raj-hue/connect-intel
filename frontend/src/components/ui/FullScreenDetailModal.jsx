import { useEffect } from 'react'
import { createPortal } from 'react-dom'

/**
 * Full-screen sheet on mobile; centered large dialog on desktop.
 * Reuse anywhere you need list → detail (Contacts, Marketing lists, etc.).
 */
export default function FullScreenDetailModal({
  open,
  onClose,
  title,
  subtitle = null,
  children,
  footer = null,
  closeOnBackdrop = false,
  ariaLabel,
  modalClassName = '',
}) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="crm-fullscreen-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel || title || 'Details'}
      onClick={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) onClose?.()
      }}
    >
      <div className={`crm-fullscreen-modal ${modalClassName}`.trim()} onClick={(e) => e.stopPropagation()}>
        <header className="crm-fullscreen-modal-header">
          <div className="min-w-0 flex-1 pr-2">
            {title ? <h2 className="crm-fullscreen-modal-title">{title}</h2> : null}
            {subtitle ? <p className="crm-fullscreen-modal-subtitle">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="crm-modal-close"
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div className="crm-fullscreen-modal-body">{children}</div>

        {footer ? <footer className="crm-fullscreen-modal-footer">{footer}</footer> : null}
      </div>
    </div>,
    document.body
  )
}
