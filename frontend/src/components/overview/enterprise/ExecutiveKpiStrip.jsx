const KPI_META = {
  tasks_today: { icon: '✓', accent: '#3b82f6' },
  followups_due: { icon: '↻', accent: '#007c89' },
  deals_closing: { icon: '₹', accent: '#059669' },
  meetings_today: { icon: '◷', accent: '#6366f1' },
  unread_updates: { icon: '●', accent: '#f59e0b' },
  new_assignments: { icon: '+', accent: '#0ea5e9' },
}

export default function ExecutiveKpiStrip({ items = [], onAction }) {
  if (!items.length) return null

  return (
    <section className="dash-ent__kpi-section" aria-label="Executive KPIs">
      <div className="dash-ent__kpi-row">
        {items.map((s) => {
          const meta = KPI_META[s.id] || { icon: '•', accent: 'var(--ci-platform-focus)' }
          return (
            <button
              key={s.id}
              type="button"
              className={`dash-ent__kpi${s.highlight ? ' is-alert' : ''}`}
              style={{ '--kpi-accent': meta.accent }}
              onClick={() => onAction(s.action)}
            >
              <span className="dash-ent__kpi-icon" aria-hidden>
                {meta.icon}
              </span>
              <span className="dash-ent__kpi-label">{s.label}</span>
              <span className="dash-ent__kpi-value">
                {s.count}
                {s.suffix || ''}
              </span>
              <span className="dash-ent__kpi-link">{s.linkLabel} →</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
