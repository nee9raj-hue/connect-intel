import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export default function ChithiNewChannelModal({ open, onClose, busy, onCreate }) {
  const [name, setName] = useState('')
  const [topic, setTopic] = useState('')

  useEffect(() => {
    if (!open) return undefined
    setName('')
    setTopic('')
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

  const handleCreate = () => {
    if (!name.trim()) return
    onCreate?.({ name: name.trim(), topic: topic.trim() })
  }

  return createPortal(
    <div
      className="chithi-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="New channel"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.()
      }}
    >
      <div className="chithi-modal chithi-modal--channel">
        <header className="chithi-modal__header">
          <h2 className="chithi-modal__title">New channel</h2>
          <button type="button" className="chithi-modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="chithi-modal__body space-y-3">
          <label className="block">
            <span className="text-[11px] font-semibold text-[#17191c]">Channel name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. deals"
              className="chithi-rail__field mt-1"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleCreate()}
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold text-[#17191c]">Topic (optional)</span>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="What is this channel for?"
              className="chithi-rail__field mt-1"
            />
          </label>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              disabled={busy || !name.trim()}
              onClick={handleCreate}
              className="flex-1 chithi-rail__btn-primary disabled:opacity-50"
            >
              Create channel
            </button>
            <button type="button" onClick={onClose} className="chithi-rail__btn-secondary !w-auto px-4">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
