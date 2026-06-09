/**
 * HubSpot-style best-practice guidance — never styled as an error.
 */
export default function GuidanceCard({
  title,
  message,
  hint,
  primaryLabel,
  onPrimary,
  secondaryLabel = 'Cancel',
  onSecondary,
  icon = '✦',
}) {
  return (
    <div className="ci-guidance-card">
      <div className="ci-guidance-card__icon" aria-hidden>
        {icon}
      </div>
      <h3 className="ci-guidance-card__title">{title}</h3>
      <p className="ci-guidance-card__message">{message}</p>
      {hint ? <div className="ci-guidance-card__hint">{hint}</div> : null}
      <div className="ci-guidance-card__actions">
        {primaryLabel && onPrimary ? (
          <button type="button" className="crm-btn crm-btn-primary" onClick={onPrimary}>
            {primaryLabel}
          </button>
        ) : null}
        {onSecondary ? (
          <button type="button" className="crm-btn crm-btn-secondary" onClick={onSecondary}>
            {secondaryLabel}
          </button>
        ) : null}
      </div>
    </div>
  )
}

export function GuidanceModal({ open, onClose, children }) {
  if (!open) return null
  return (
    <div
      className="crm-modal-overlay"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.()
      }}
    >
      <div className="crm-modal-dialog ci-guidance-modal" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}
