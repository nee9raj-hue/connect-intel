/** Activity Log hub charts — Vite-safe CSS/SVG. */

import { DashboardNavIcon } from '../dashboard/dashboardUi'

const ORANGE = '#FF773D'

export function TypeBreakdownBar({ rows = [], activeType, onSelect }) {
  if (!rows.length) return <p className="ti3-empty">No activity types yet.</p>
  const max = Math.max(1, ...rows.map((r) => r.count))

  return (
    <div className="ti3-log-types">
      {rows.map((row) => (
        <button
          key={row.type}
          type="button"
          className={`ti3-log-type-row${activeType === row.type ? ' is-active' : ''}`}
          onClick={() => onSelect?.(row.type)}
        >
          <span className="ti3-log-type-row__label">{row.label}</span>
          <span className="ti3-log-type-row__track">
            <i style={{ width: `${(row.count / max) * 100}%` }} />
          </span>
          <span className="ti3-log-type-row__count">{row.count}</span>
        </button>
      ))}
    </div>
  )
}

export function RepActivityBars({ rows = [], onSelect }) {
  if (!rows.length) return <p className="ti3-empty">No rep activity this period.</p>
  const max = Math.max(1, ...rows.map((r) => r.total))

  return (
    <div className="ti3-log-reps">
      {rows.map((row) => (
        <button
          key={row.userId}
          type="button"
          className="ti3-log-rep-row"
          onClick={() => onSelect?.(row.userId)}
        >
          <span className="ti3-log-rep-row__name">{row.name?.split(' ')[0] || 'Rep'}</span>
          <span className="ti3-log-rep-row__track">
            <i style={{ width: `${(row.total / max) * 100}%`, background: ORANGE }} />
          </span>
          <span className="ti3-log-rep-row__meta">
            {row.total} · {row.calls}C {row.emails}E
          </span>
        </button>
      ))}
    </div>
  )
}

export function ActivityTrendMini({ trend = [] }) {
  if (!trend.length) return <p className="ti3-empty">No trend data.</p>
  const max = Math.max(1, ...trend.map((d) => d.count))
  const w = 100
  const h = 56
  const pad = 4
  const step = trend.length > 1 ? (w - pad * 2) / (trend.length - 1) : 0
  const points = trend
    .map((d, i) => {
      const x = pad + i * step
      const y = h - pad - (d.count / max) * (h - pad * 2)
      return `${x},${y}`
    })
    .join(' ')

  return (
    <div className="ti3-log-trend">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="ti3-log-trend__svg" aria-hidden>
        <polyline fill="none" stroke={ORANGE} strokeWidth="2" points={points} />
      </svg>
      <div className="ti3-log-trend__labels">
        <span>{trend[0]?.label}</span>
        <span>{trend[trend.length - 1]?.label}</span>
      </div>
    </div>
  )
}

export function QuickLinksHub({ links = [], onNavigate }) {
  if (!links.length) return null
  return (
    <div className="ti3-log-links">
      {links.map((link) => (
        <button
          key={link.id}
          type="button"
          className={`ti3-log-link${link.highlight ? ' is-highlight' : ''}`}
          onClick={() =>
            onNavigate?.(link.panel, {
              activityType: link.activityType,
              userId: link.userId,
            })
          }
        >
          {link.icon ? (
            <DashboardNavIcon name={link.icon} className="ti3-log-link__icon" />
          ) : null}
          <span>{link.label}</span>
        </button>
      ))}
    </div>
  )
}

export function FilterChips({ filters = [], value, onChange }) {
  return (
    <div className="ti3-log-filters" role="tablist" aria-label="Activity type">
      {filters.map((f) => (
        <button
          key={f.id}
          type="button"
          role="tab"
          aria-selected={value === f.id || (!value && f.id === 'all')}
          className={`ti3-log-filter${value === f.id || (!value && f.id === 'all') ? ' is-active' : ''}`}
          onClick={() => onChange?.(f.id === 'all' ? null : f.id)}
        >
          {f.label}
        </button>
      ))}
    </div>
  )
}
