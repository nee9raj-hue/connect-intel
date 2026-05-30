import { useEffect } from 'react'
import { createPortal } from 'react-dom'

/**
 * Standalone full-screen page for mobile/PWA filter pickers (close control on the left).
 */
export default function MobileFilterFullPage({ open, onClose, title, children, footer = null, ariaLabel }) {
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
      className="crm-mobile-filter-page"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel || title || 'Filter'}
    >
      <header className="crm-mobile-filter-page__header">
        <button type="button" className="crm-mobile-filter-page__close" onClick={onClose} aria-label="Close">
          ×
        </button>
        {title ? <h2 className="crm-mobile-filter-page__title">{title}</h2> : null}
      </header>

      <div className="crm-mobile-filter-page__body">{children}</div>

      {footer ? <footer className="crm-mobile-filter-page__footer">{footer}</footer> : null}
    </div>,
    document.body
  )
}
