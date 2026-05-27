import BulkEmailCompose from './BulkEmailCompose'

export default function BulkEmailModal({ open, leadIds, leads, onClose, onDone }) {
  if (!open) return null

  return (
    <div
      className="crm-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-email-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="crm-modal-dialog" onClick={(e) => e.stopPropagation()}>
        <header className="crm-modal-header">
          <h2 id="bulk-email-title">Bulk email ({leadIds.length} selected)</h2>
          <button type="button" onClick={onClose} className="crm-modal-close" aria-label="Close">
            ×
          </button>
        </header>
        <div className="crm-modal-body-fill">
          <BulkEmailCompose leadIds={leadIds} leads={leads} onDone={onDone} compact />
        </div>
      </div>
    </div>
  )
}
