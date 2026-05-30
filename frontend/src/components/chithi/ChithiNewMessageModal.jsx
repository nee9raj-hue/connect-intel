import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import ChithiTeammatePicker from './ChithiTeammatePicker'

export default function ChithiNewMessageModal({ open, onClose, members, busy, loading, onSelect }) {
  useEffect(() => {
    if (!open) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="chithi-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="New direct message"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.()
      }}
    >
      <div className="chithi-modal chithi-modal--dm">
        <header className="chithi-modal__header">
          <h2 className="chithi-modal__title">New direct message</h2>
          <button type="button" className="chithi-modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="chithi-modal__body">
          <ChithiTeammatePicker
            members={members}
            busy={busy}
            loading={loading}
            onSelect={onSelect}
            onCancel={onClose}
          />
        </div>
      </div>
    </div>,
    document.body
  )
}
