import { createPortal } from 'react-dom'

/** Centered filter popout with close, apply, and optional clear. */
export default function PipelineFilterPopout({
  open,
  title,
  subtitle = null,
  onClose,
  onApply,
  onClear,
  applyLabel = 'Apply',
  children,
}) {
  if (!open) return null

  return createPortal(
    <>
      <button type="button" className="pipeline-filter-popout-backdrop" aria-label="Close" onClick={onClose} />
      <div className="pipeline-filter-popout" role="dialog" aria-label={title}>
        <header className="pipeline-filter-popout__head">
          <div className="min-w-0">
            <h2 className="pipeline-filter-popout__title">{title}</h2>
            {subtitle ? <p className="pipeline-filter-popout__sub">{subtitle}</p> : null}
          </div>
          <button type="button" className="pipeline-filter-popout__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="pipeline-filter-popout__body">{children}</div>
        <footer className="pipeline-filter-popout__foot">
          {onClear ? (
            <button type="button" className="crm-btn crm-btn-ghost" onClick={onClear}>
              Clear
            </button>
          ) : (
            <span />
          )}
          <button type="button" className="crm-btn crm-btn-primary" onClick={onApply}>
            {applyLabel}
          </button>
        </footer>
      </div>
    </>,
    document.body
  )
}
