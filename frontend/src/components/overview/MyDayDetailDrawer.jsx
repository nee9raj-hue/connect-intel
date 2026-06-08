import { formatDateTime } from '../../lib/crmUiConstants'

export default function MyDayDetailDrawer({
  open,
  title,
  subtitle,
  count,
  items = [],
  emptyMessage = 'Nothing here right now.',
  viewAllLabel,
  onClose,
  onOpenItem,
  onViewAll,
}) {
  if (!open) return null

  return (
    <div className="myday-drawer-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="myday-drawer" onClick={(e) => e.stopPropagation()}>
        <header className="myday-drawer__head">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
            {count != null ? <span className="myday-drawer__count">{count} item{count === 1 ? '' : 's'}</span> : null}
          </div>
          <button type="button" className="myday-drawer__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="myday-drawer__body">
          {!items.length ? (
            <p className="myday-drawer__empty">{emptyMessage}</p>
          ) : (
            <ul className="myday-drawer__list">
              {items.map((item) => (
                <li key={item.id}>
                  <button type="button" className="myday-drawer__row" onClick={() => onOpenItem?.(item)}>
                    <span className="myday-drawer__row-main">
                      <strong>{item.title}</strong>
                      {item.subtitle ? <span>{item.subtitle}</span> : null}
                    </span>
                    {item.dueAt ? <time>{formatDateTime(item.dueAt)}</time> : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {viewAllLabel && onViewAll ? (
          <footer className="myday-drawer__foot">
            <button type="button" className="myday-drawer__view-all" onClick={onViewAll}>
              {viewAllLabel}
            </button>
            <p className="myday-drawer__hint">You can return to Dashboard anytime from the bar at the top.</p>
          </footer>
        ) : null}
      </div>
    </div>
  )
}
